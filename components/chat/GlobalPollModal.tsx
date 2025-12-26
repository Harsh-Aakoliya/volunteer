// components/chat/GlobalPollModal.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { API_URL } from '@/constants/api';
import DateTimePicker from './DateTimePicker';

type PollOption = {
  id: string;
  text: string;
};

type PollData = {
  id: number;
  question: string;
  options: PollOption[];
  votes: { [optionId: string]: string[] } | null;
  roomId: number;
  isActive: boolean;
  pollEndTime: string;
  isMultipleChoiceAllowed: boolean;
  createdBy: string;
  createdAt: string;
};

type Props = {
  pollId: number | null;
  visible: boolean;
  onClose: () => void;
  currentUserId: string;
  totalMembers: number;
};

const GlobalPollModal = ({ pollId, visible, onClose, currentUserId, totalMembers }: Props) => {
  const [pollData, setPollData] = useState<PollData | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [timeLeft, setTimeLeft] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  
  // New states for instant voting
  const [votingOptions, setVotingOptions] = useState<{[optionId: string]: 'idle' | 'voting' | 'voted'}>({});
  
  // States for reactivation
  const [showReactivateModal, setShowReactivateModal] = useState(false);
  const [reactivateDate, setReactivateDate] = useState<Date | null>(null);
  const [reactivateTime, setReactivateTime] = useState<string | null>(null);
  
  // Loading states for buttons
  const [toggleStatusLoading, setToggleStatusLoading] = useState(false);
  const [reactivateLoading, setReactivateLoading] = useState(false);

  const initializeVotingStates = (pollData: PollData) => {
    // Find user's existing votes and set voting states accordingly
    const userVotedOptions: string[] = [];
    const votingStates: {[optionId: string]: 'idle' | 'voting' | 'voted'} = {};
    
    if (pollData.votes) {
      Object.keys(pollData.votes).forEach(optionId => {
        const voters = pollData.votes![optionId] || [];
        if (voters.includes(currentUserId)) {
          userVotedOptions.push(optionId);
          votingStates[optionId] = 'voted';
        } else {
          votingStates[optionId] = 'idle';
        }
      });
    }
    
    // Initialize all options as idle if no votes found
    pollData.options.forEach(option => {
      if (!votingStates[option.id]) {
        votingStates[option.id] = 'idle';
      }
    });
    
    setSelectedOptions(userVotedOptions);
    setVotingOptions(votingStates);
  };

  const fetchPollData = async () => {
    if (!pollId) return;
    
    try {
      setLoading(true);
      console.log('Fetching poll data for poll:', pollId);
      const response = await axios.get(`${API_URL}/api/poll/${pollId}`);
      const pollData = response.data.polldata;
      setPollData(pollData);
      
      // Initialize voting states based on existing votes
      initializeVotingStates(pollData);
      
      console.log('Poll data fetched successfully');
    } catch (error) {
      console.log('Error fetching poll data:', error);
      Alert.alert('Error', 'Failed to fetch poll data');
    } finally {
      setLoading(false);
    }
  };

  const refreshPoll = async () => {
    setRefreshing(true);
    await fetchPollData();
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

  const updatePollDataFromResponse = (pollResponse: any) => {
    if (pollResponse && pollResponse.poll) {
      const updatedPoll = pollResponse.poll;
      
      // Parse options if they're string
      if (typeof updatedPoll.options === 'string') {
        updatedPoll.options = JSON.parse(updatedPoll.options);
      }
      
      // Update poll data without refetching
      setPollData(updatedPoll);
      
      // Reinitialize voting states based on updated votes
      initializeVotingStates(updatedPoll);
    }
  };

  const handleOptionSelect = async (optionId: string) => {
    if (!pollData || !pollId) return;
    
    // Check if user can vote
    const canVote = pollData.isActive && timeLeft !== 'Poll Ended';
    if (!canVote) return;
    
    // Set voting state for this option
    setVotingOptions(prev => ({ ...prev, [optionId]: 'voting' }));
    
    try {
      let optionsToSubmit: string[];
      
      if (!pollData.isMultipleChoiceAllowed) {
        // Single choice - submit only the selected option
        optionsToSubmit = [optionId];
      } else {
        // Multiple choice - toggle selection
        const currentSelected = selectedOptions.includes(optionId);
        if (currentSelected) {
          // Remove option (deselect)
          optionsToSubmit = selectedOptions.filter(id => id !== optionId);
        } else {
          // Add option (select)
          optionsToSubmit = [...selectedOptions, optionId];
        }
      }
      
      // Submit vote immediately
      const response = await axios.post(`${API_URL}/api/poll/${pollId}/vote`, {
        userId: currentUserId,
        selectedOptions: optionsToSubmit
      });
      
      // Update poll data from response - this will automatically handle
      // vote states, selected options, and vote counts
      updatePollDataFromResponse(response.data);
      
    } catch (error: any) {
      console.error('Error submitting vote:', error);
      const errorMessage = error.response?.data?.error || 'Failed to submit vote';
      Alert.alert('Error', errorMessage);
      
      // Reset voting state on error
      setVotingOptions(prev => ({ ...prev, [optionId]: 'idle' }));
    }
  };



  const togglePollStatus = async () => {
    if (!pollId || toggleStatusLoading) return;

    // If poll is inactive and we want to activate, show date picker
    if (!pollData?.isActive) {
      setShowReactivateModal(true);
      return;
    }

    // If poll is active, deactivate immediately
    setToggleStatusLoading(true);
    try {
      const response = await axios.patch(`${API_URL}/api/poll/${pollId}/toggle`, {
        userId: currentUserId
      });
      
      console.log('Poll deactivated');
      Alert.alert('Success', 'Poll deactivated successfully!');
      
      // Update poll data from response instead of refetching
      updatePollDataFromResponse(response.data);
    } catch (error: any) {
      console.error('Error deactivating poll:', error);
      const errorMessage = error.response?.data?.error || 'Failed to deactivate poll';
      Alert.alert('Error', errorMessage);
    } finally {
      setToggleStatusLoading(false);
    }
  };

  const handleReactivatePoll = async () => {
    if (!pollId || !reactivateDate || !reactivateTime || reactivateLoading) {
      if (!reactivateDate || !reactivateTime) {
        Alert.alert('Error', 'Please select end date and time');
      }
      return;
    }

    setReactivateLoading(true);
    try {
      // Combine date and time
      const [hours, minutes] = reactivateTime.split(':');
      const endDateTime = new Date(reactivateDate);
      endDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);

      const response = await axios.patch(`${API_URL}/api/poll/${pollId}/reactivate`, {
        userId: currentUserId,
        pollEndTime: endDateTime.toISOString()
      });
      
      console.log('Poll reactivated');
      Alert.alert('Success', 'Poll reactivated successfully!');
      setShowReactivateModal(false);
      setReactivateDate(null);
      setReactivateTime(null);
      
      // Update poll data from response instead of refetching
      updatePollDataFromResponse(response.data);
    } catch (error: any) {
      console.error('Error reactivating poll:', error);
      const errorMessage = error.response?.data?.error || 'Failed to reactivate poll';
      Alert.alert('Error', errorMessage);
    } finally {
      setReactivateLoading(false);
    }
  };

  const handleEditPoll = async () => {
    Alert.alert(
      'Edit Poll',
      'Edit functionality can be implemented with a separate modal',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'OK', 
          onPress: () => {
            console.log('Edit poll requested');
          }
        }
      ]
    );
  };

  // Reset state when modal opens/closes
  useEffect(() => {
    if (visible && pollId) {
      setSelectedOptions([]);
      setVotingOptions({});
      setShowReactivateModal(false);
      setReactivateDate(null);
      setReactivateTime(null);
      fetchPollData();
    } else if (!visible) {
      setPollData(null);
      setSelectedOptions([]);
      setVotingOptions({});
      setLoading(false);
      setRefreshing(false);
      setShowReactivateModal(false);
      setReactivateDate(null);
      setReactivateTime(null);
    }
  }, [visible, pollId]);

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

  if (!visible) return null;

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
              onPress={onClose}
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
              {isCreator ? (
                <>
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
                </>
              ) : (
                <View className="flex-row items-center">
                  <Ionicons 
                    name={pollData.isActive ? "radio-button-on" : "radio-button-off"} 
                    size={14} 
                    color={pollData.isActive ? "#10B981" : "#EF4444"} 
                  />
                  <Text className={`ml-2 text-sm font-medium ${pollData.isActive ? 'text-green-600' : 'text-red-500'}`}>
                    {pollData.isActive ? 'Active' : 'Inactive'}
                    {pollData.isActive && timeLeft && (
                      <Text className="text-gray-500"> ({timeLeft})</Text>
                    )}
                  </Text>
                </View>
              )}
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
                onPress={onClose}
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

              {/* Poll Info - Simplified for all users */}
              <View className="bg-blue-50 rounded-lg p-3 mb-4">
                <View className="flex-row justify-between items-center">
                  <Text className="text-sm text-blue-700 font-medium">
                    Time Left: {timeLeft}
                  </Text>
                  <Text className="text-sm text-blue-700 font-medium">
                    {pollData.isMultipleChoiceAllowed ? 'Multiple Choice' : 'Single Choice'}
                  </Text>
                </View>
              </View>

              {/* Options */}
              <View className="space-y-4">
                {pollData.options.map((option, index) => {
                  const voteCount = getVoteCount(option.id);
                  const percentage = getVotePercentage(option.id);
                  const isSelected = selectedOptions.includes(option.id);
                  const votingState = votingOptions[option.id] || 'idle';

                  return (
                    <TouchableOpacity
                      key={option.id}
                      onPress={() => canVote && handleOptionSelect(option.id)}
                      disabled={!canVote || votingState === 'voting'}
                      className={`border-2 rounded-xl p-4 ${
                        isSelected 
                          ? 'border-blue-500 bg-blue-50' 
                          : 'border-gray-200 bg-gray-50'
                      } ${!canVote ? 'opacity-70' : ''}`}
                    >
                      <View className="flex-row items-center justify-between">
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

                        {/* Voting State Indicator */}
                        <View className="ml-2">
                          {votingState === 'voting' && (
                            <ActivityIndicator size="small" color="#3B82F6" />
                          )}
                          {votingState === 'voted' && (
                            <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                          )}
                        </View>

                        {/* Author View - Show vote counts and progress */}
                        {isCreator && (
                          <View className="items-end ml-3">
                            <Text className="text-sm font-bold text-gray-800">
                              {voteCount} {voteCount === 1 ? 'vote' : 'votes'}
                            </Text>
                            <Text className="text-xs text-gray-500">
                              {percentage}%
                            </Text>
                          </View>
                        )}
                      </View>

                      {/* Progress Bar - Only for author */}
                      {isCreator && (
                        <View className="h-2 bg-gray-200 rounded-full overflow-hidden mt-2">
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

              {/* Author Additional Stats */}
              {isCreator && (
                <View className="mt-4 p-3 bg-gray-50 rounded-lg">
                  <Text className="text-sm font-medium text-gray-700 text-center">
                    {uniqueVoters} out of {totalMembers} members have voted
                  </Text>
                  <View className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <View 
                      className="h-full bg-green-500 rounded-full"
                      style={{ width: `${totalMembers > 0 ? (uniqueVoters / totalMembers) * 100 : 0}%` }}
                    />
                  </View>
                  <Text className="text-xs text-gray-500 text-center mt-1">
                    {totalMembers > 0 ? Math.round((uniqueVoters / totalMembers) * 100) : 0}% participation
                  </Text>
                </View>
              )}

              {/* Creator Controls - Moved to bottom */}
              {isCreator && (
                <View className="flex-row mt-6 space-x-2">
                  <TouchableOpacity
                    onPress={togglePollStatus}
                    disabled={toggleStatusLoading}
                    className={`flex-1 py-3 px-4 rounded-lg ${
                      toggleStatusLoading 
                        ? 'bg-gray-100' 
                        : pollData.isActive 
                          ? 'bg-red-100' 
                          : 'bg-green-100'
                    }`}
                  >
                    <View className="flex-row items-center justify-center">
                      {toggleStatusLoading && <ActivityIndicator size="small" color="#6B7280" style={{ marginRight: 4 }} />}
                      <Text className={`text-center text-sm font-medium ${
                        toggleStatusLoading 
                          ? 'text-gray-500'
                          : pollData.isActive 
                            ? 'text-red-700' 
                            : 'text-green-700'
                      }`}>
                        {toggleStatusLoading 
                          ? (pollData.isActive ? 'Deactivating...' : 'Activating...') 
                          : (pollData.isActive ? 'Deactivate' : 'Activate')}
                      </Text>
                    </View>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    onPress={handleEditPoll}
                    className="flex-1 py-3 px-4 rounded-lg bg-blue-100"
                  >
                    <Text className="text-center text-sm font-medium text-blue-700">
                      Edit Poll
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </ScrollView>

          {/* Reactivation Modal */}
          {showReactivateModal && (
            <Modal visible={showReactivateModal} transparent animationType="slide">
              <View className="flex-1 justify-end bg-black bg-opacity-50">
                <View className="bg-white rounded-t-3xl p-6 max-h-96">
                  <Text className="text-xl font-bold text-gray-800 text-center mb-4">
                    Reactivate Poll
                  </Text>
                  <Text className="text-gray-600 text-center mb-4">
                    Select new end date and time for the poll
                  </Text>
                  
                  <DateTimePicker
                    selectedDate={reactivateDate}
                    setSelectedDate={setReactivateDate}
                    selectedTime={reactivateTime} 
                    setSelectedTime={setReactivateTime}
                  />
                  
                  <View className="mt-6 space-y-3">
                    <TouchableOpacity
                      className={`py-4 rounded-lg ${reactivateLoading ? 'bg-gray-400' : 'bg-green-500'}`}
                      disabled={reactivateLoading}
                      onPress={handleReactivatePoll}
                    >
                      <View className="flex-row items-center justify-center">
                        {reactivateLoading && <ActivityIndicator size="small" color="white" style={{ marginRight: 8 }} />}
                        <Text className="text-white text-center font-semibold text-lg">
                          {reactivateLoading ? 'Activating...' : 'Activate Poll'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                      onPress={() => setShowReactivateModal(false)}
                      className="py-3"
                    >
                      <Text className="text-gray-500 text-center font-medium">Cancel</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </Modal>
          )}
        </View>
      </View>
    </Modal>
  );
};

export default GlobalPollModal;
