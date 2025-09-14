import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { pollCache, PollData, PollOption } from '@/utils/pollCache';

const { width: screenWidth } = Dimensions.get('window');

type Props = {
  pollid: number;
  setShowPollModel: React.Dispatch<React.SetStateAction<boolean>>;
  currentUserId: string; 
  visible: boolean;
  totalMembers:number;
};

const RenderPoll = ({ pollid, setShowPollModel, currentUserId, visible,totalMembers }: Props) => {
  const [pollData, setPollData] = useState<PollData | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [timeLeft, setTimeLeft] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [toggleStatusLoading, setToggleStatusLoading] = useState(false);

  const fetchPollData = async (force: boolean = false) => {
    console.log('Fetching poll data:', pollid);
    try {
      const data = await pollCache.fetchPollData(pollid, force);
      if (data) {
        setPollData(data);
        console.log('Poll data fetched:', data);
      } else {
        Alert.alert('Error', 'Failed to fetch poll data');
      }
    } catch (error) {
      console.log('Error fetching poll data:', error);
      Alert.alert('Error', 'Failed to fetch poll data');
    }
  };

  const refreshPoll = async () => {
    setRefreshing(true);
    await fetchPollData(true); // Force refresh
    setRefreshing(false);
  };

  const calculateTimeLeft = () => {
    if (!pollData?.pollEndTime) return '';

    // Get current time in IST
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000; // IST is UTC+5:30
    const istNow = new Date(now.getTime() + istOffset);
    
    // Poll end time is already in IST from backend
    const endTime = new Date(pollData.pollEndTime);
    const timeDiff = endTime.getTime() - istNow.getTime();

    if (timeDiff <= 0) return 'Poll Ended';

    const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const handleOptionSelect = (optionId: string) => {
    if (!pollData?.isMultipleChoiceAllowed) {
      setSelectedOptions([optionId]);
    } else {
      setSelectedOptions(prev => 
        prev.includes(optionId) 
          ? prev.filter(id => id !== optionId)
          : [...prev, optionId]
      );
    }
  };

  // API Functions using poll cache
  const submitVoteAPI = async (pollId: number, userId: string, selectedOptions: string[]) => {
    return await pollCache.submitVote(pollId, userId, selectedOptions);
  };

  const togglePollStatusAPI = async (pollId: number, userId: string) => {
    return await pollCache.togglePollStatus(pollId, userId);
  };

  const updatePollAPI = async (pollId: number, userId: string, updateData: any) => {
    return await pollCache.updatePoll(pollId, userId, updateData);
  };

  const submitVote = async () => {
    if (selectedOptions.length === 0) {
      Alert.alert('Error', 'Please select at least one option');
      return;
    }

    try {
      const result = await submitVoteAPI(pollid, currentUserId, selectedOptions);
      console.log('Vote submitted successfully:', result);
      Alert.alert('Success', 'Your vote has been submitted!');
      setSelectedOptions([]); // Clear selections after successful vote
      // No need to manually refresh as poll cache handles this automatically
    } catch (error: any) {
      console.error('Error submitting vote:', error);
      const errorMessage = error.response?.data?.error || 'Failed to submit vote';
      Alert.alert('Error', errorMessage);
    }
  };

  const togglePollStatus = async () => {
    if (toggleStatusLoading) return;

    setToggleStatusLoading(true);
    try {
      const result = await togglePollStatusAPI(pollid, currentUserId);
      console.log('Poll status toggled:', result);
      Alert.alert('Success', `Poll ${pollData?.isActive ? 'deactivated' : 'activated'} successfully!`);
      // No need to manually refresh as poll cache handles this automatically
    } catch (error: any) {
      console.error('Error toggling poll status:', error);
      const errorMessage = error.response?.data?.error || 'Failed to update poll status';
      Alert.alert('Error', errorMessage);
    } finally {
      setToggleStatusLoading(false);
    }
  };

  const handleEditPoll = async () => {
    // You can implement a separate modal or screen for editing
    // For now, let's just show an alert
    Alert.alert(
      'Edit Poll',
      'Edit functionality can be implemented with a separate modal',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'OK', 
          onPress: () => {
            // Navigate to edit screen or show edit modal
            console.log('Edit poll requested');
          }
        }
      ]
    );
  };

  useEffect(() => {
    if (visible && pollid) {
      // Check for cached data first
      const cachedData = pollCache.getCachedData(pollid);
      if (cachedData) {
        setPollData(cachedData);
      }
      
      // Set initial loading state based on cache status
      setLoading(pollCache.isLoading(pollid));
      
      // Fetch data (will use cache if available)
      fetchPollData();
    }
  }, [visible, pollid]);

  useEffect(() => {
    if (!pollid) return;

    // Subscribe to loading state changes
    const unsubscribeLoading = pollCache.onLoadingChange((pollIdFromCache, isLoading) => {
      if (pollIdFromCache === pollid) {
        setLoading(isLoading);
      }
    });

    // Subscribe to data changes
    const unsubscribeData = pollCache.onDataChange((pollIdFromCache, data) => {
      if (pollIdFromCache === pollid) {
        setPollData(data);
      }
    });

    return () => {
      unsubscribeLoading();
      unsubscribeData();
    };
  }, [pollid]);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 60000); // Update every minute

    setTimeLeft(calculateTimeLeft());
    return () => clearInterval(timer);
  }, [pollData]);

  const isCreator = pollData?.createdBy === currentUserId;
  const canVote = pollData?.isActive && timeLeft !== 'Poll Ended';
  
  // Calculate unique voters across all options
  const uniqueVoters = pollData?.votes 
    ? new Set(Object.values(pollData.votes).flat()).size
    : 0;

  const getVoteCount = (optionId: string) => {
    return pollData?.votes?.[optionId]?.length || 0;
  };

  const getVotePercentage = (optionId: string) => {
    if (totalMembers === 0) return 0;
    return Math.round((getVoteCount(optionId) / totalMembers) * 100);
  };

  if (loading) {
    return (
      <Modal visible={visible} transparent animationType="slide">
        <View className="flex-1 bg-black/50 justify-center items-center px-4">
          <View className="bg-white rounded-2xl p-8 w-full max-w-sm">
            <ActivityIndicator size="large" color="#3B82F6" />
            <Text className="text-center mt-4 text-gray-600 text-base">Loading poll...</Text>
          </View>
        </View>
      </Modal>
    );
  }

  if (!pollData) {
    return (
      <Modal visible={visible} transparent animationType="slide">
        <View className="flex-1 bg-black/50 justify-center items-center px-4">
          <View className="bg-white rounded-2xl p-8 w-full max-w-sm">
            <Text className="text-center text-red-500 text-base mb-4">Failed to load poll data</Text>
            <TouchableOpacity
              onPress={() => setShowPollModel(false)}
              className="bg-gray-200 rounded-lg py-3 px-6"
            >
              <Text className="text-center text-gray-700 font-medium">Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View className="flex-1 bg-black/50 justify-center items-center px-4">
        <View className="bg-white rounded-2xl w-full h-[85%]">
          {/* Header */}
          <View className="flex-row justify-between items-center p-4 border-b border-gray-200">
            <View className="flex-1">
              <Text className="text-lg font-bold text-gray-800">Poll</Text>
              <View className="flex-row items-center mt-1">
                <Ionicons 
                  name={pollData.isActive ? "radio-button-on" : "radio-button-off"} 
                  size={12} 
                  color={pollData.isActive ? "#10B981" : "#EF4444"} 
                />
                <Text className={`ml-1 text-xs ${pollData.isActive ? 'text-green-600' : 'text-red-500'}`}>
                  {pollData.isActive ? 'Active' : 'Inactive'}
                </Text>
              </View>
            </View>
            
            <View className="flex-row items-center">
              <TouchableOpacity
                onPress={refreshPoll}
                disabled={refreshing}
                className="mr-3 p-2"
              >
                <Ionicons 
                  name="refresh" 
                  size={20} 
                  color={refreshing ? "#9CA3AF" : "#3B82F6"} 
                />
              </TouchableOpacity>
              
              <TouchableOpacity
                onPress={() => setShowPollModel(false)}
                className="p-2"
              >
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView className="flex-1 px-4 py-2" showsVerticalScrollIndicator={false}>
            {/* Poll Question */}
            <View className="mb-4">
              <Text className="text-xl font-semibold text-gray-800 mb-3">
                {pollData.question}
              </Text>

              {/* Poll Info */}
              <View className="bg-blue-50 rounded-lg p-3 mb-4">
                <View className="flex-row justify-between items-center mb-2">
                  <Text className="text-sm text-blue-700 font-medium">
                    Time Left: {timeLeft}
                  </Text>
                  <Text className="text-sm text-blue-700">
                    Voters: {uniqueVoters}
                  </Text>
                </View>
                
                <View className="flex-row justify-between items-center">
                  <Text className="text-xs text-blue-600">
                    {pollData.isMultipleChoiceAllowed ? 'Multiple Choice' : 'Single Choice'}
                  </Text>
                  <Text className="text-xs text-blue-600">
                    Total Members: {totalMembers}
                  </Text>
                </View>
              </View>

              {/* Creator Actions */}
              {isCreator && (
                <View className="flex-row mb-4 space-x-2">
                  <TouchableOpacity
                    onPress={togglePollStatus}
                    className={`flex-1 py-2 px-4 rounded-lg ${
                      pollData.isActive ? 'bg-red-100' : 'bg-green-100'
                    }`}
                  >
                    <Text className={`text-center text-sm font-medium ${
                      pollData.isActive ? 'text-red-700' : 'text-green-700'
                    }`}>
                      {pollData.isActive ? 'Deactivate' : 'Activate'}
                    </Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    onPress={handleEditPoll}
                    className="flex-1 py-2 px-4 rounded-lg bg-blue-100"
                  >
                    <Text className="text-center text-sm font-medium text-blue-700">
                      Edit Poll
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Options */}
              <View className="space-y-4">
                {pollData.options.map((option: PollOption, index: number) => {
                  const voteCount = getVoteCount(option.id);
                  const percentage = getVotePercentage(option.id);
                  const isSelected = selectedOptions.includes(option.id);

                  return (
                    <TouchableOpacity
                      key={option.id}
                      onPress={() => canVote && handleOptionSelect(option.id)}
                      disabled={!canVote}
                      className={`border-2 rounded-xl p-4 ${
                        isSelected 
                          ? 'border-blue-500 bg-blue-50' 
                          : 'border-gray-200 bg-gray-50'
                      } ${!canVote ? 'opacity-70' : ''}`}
                    >
                      <View className="flex-row items-center justify-between mb-2">
                        <View className="flex-row items-center flex-1">
                          <View className={`w-5 h-5 rounded-full border-2 mr-3 ${
                            pollData.isMultipleChoiceAllowed ? 'rounded-sm' : ''
                          } ${
                            isSelected 
                              ? 'border-blue-500 bg-blue-500' 
                              : 'border-gray-300'
                          }`}>
                            {isSelected && (
                              <Ionicons 
                                name={pollData.isMultipleChoiceAllowed ? "checkmark" : "radio-button-on"} 
                                size={pollData.isMultipleChoiceAllowed ? 16 : 20} 
                                color="white" 
                                style={{ alignSelf: 'center' }}
                              />
                            )}
                          </View>
                          
                          <Text className={`flex-1 text-base ${
                            isSelected ? 'text-blue-700 font-medium' : 'text-gray-700'
                          }`}>
                            {option.text}
                          </Text>
                        </View>

                        {(isCreator || uniqueVoters > 0) && (
                          <View className="items-end">
                            <Text className="text-sm font-bold text-gray-800">
                              {voteCount} {voteCount === 1 ? 'vote' : 'votes'}
                            </Text>
                            <Text className="text-xs text-gray-500">
                              {percentage}%
                            </Text>
                          </View>
                        )}
                      </View>

                      {/* Progress Bar */}
                      {(isCreator || uniqueVoters > 0) && (
                        <View className="h-2 bg-gray-200 rounded-full overflow-hidden">
                          <View 
                            className="h-full bg-blue-500 rounded-full"
                            style={{ width: `${percentage}%` }}
                          />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>


              {/* Vote Button */}
              {canVote && !isCreator && (
                <TouchableOpacity
                  onPress={submitVote}
                  disabled={selectedOptions.length === 0}
                  className={`mt-6 py-4 rounded-xl ${
                    selectedOptions.length > 0 
                      ? 'bg-blue-500' 
                      : 'bg-gray-300'
                  }`}
                >
                  <Text className={`text-center font-semibold ${
                    selectedOptions.length > 0 
                      ? 'text-white' 
                      : 'text-gray-500'
                  }`}>
                    Submit Vote
                  </Text>
                </TouchableOpacity>
              )}

              {/* Poll End Message */}
              {timeLeft === 'Poll Ended' && (
                <View className="mt-4 bg-red-50 rounded-lg p-3">
                  <Text className="text-center text-red-700 font-medium">
                    This poll has ended
                  </Text>
                </View>
              )}

              {/* Poll Metadata */}
              <View className="mt-6 pt-4 border-t border-gray-200">
                <Text className="text-xs text-gray-500 text-center">
                  Created on {new Date(pollData.createdAt).toLocaleDateString('en-IN', {
                    timeZone: 'Asia/Kolkata',
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </Text>
                <Text className="text-xs text-gray-500 text-center mt-1">
                  Ends on {new Date(pollData.pollEndTime).toLocaleDateString('en-IN', {
                    timeZone: 'Asia/Kolkata',
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </Text>
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

export default RenderPoll;