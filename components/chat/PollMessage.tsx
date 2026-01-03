// components/chat/PollMessage.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { API_URL } from '@/constants/api';

type PollOption = {
  id: string;
  text: string;
};

type PollData = {
  id: number;
  question: string;
  options: PollOption[];
  votes: { [optionId: string]: string[] } | null;
  isActive: boolean;
  pollEndTime: string;
  isMultipleChoiceAllowed: boolean;
  createdBy: string;
};

type Props = {
  pollId: number;
  currentUserId: string;
  isOwnMessage: boolean;
  onViewResults: (pollId: number) => void;
};

const PollMessage = ({ pollId, currentUserId, isOwnMessage, onViewResults }: Props) => {
  const [pollData, setPollData] = useState<PollData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [votingOptions, setVotingOptions] = useState<{[optionId: string]: 'idle' | 'voting' | 'voted'}>({});

  const fetchPollData = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/poll/${pollId}`);
      const data = response.data.polldata;
      setPollData(data);
      
      // Initialize voting states
      const userVotedOptions: string[] = [];
      const votingStates: {[optionId: string]: 'idle' | 'voting' | 'voted'} = {};
      
      if (data.votes) {
        Object.keys(data.votes).forEach(optionId => {
          const voters = data.votes![optionId] || [];
          if (voters.includes(currentUserId)) {
            userVotedOptions.push(optionId);
            votingStates[optionId] = 'voted';
          } else {
            votingStates[optionId] = 'idle';
          }
        });
      }
      
      data.options.forEach((option: PollOption) => {
        if (!votingStates[option.id]) {
          votingStates[option.id] = 'idle';
        }
      });
      
      setSelectedOptions(userVotedOptions);
      setVotingOptions(votingStates);
    } catch (error) {
      console.error('Error fetching poll:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPollData();
  }, [pollId]);

  const handleOptionSelect = async (optionId: string) => {
    if (!pollData) return;
    
    // Check if poll is active
    const now = new Date();
    const endTime = new Date(pollData.pollEndTime);
    const isPollActive = pollData.isActive && now < endTime;
    
    if (!isPollActive) {
      Alert.alert('Poll Ended', 'This poll is no longer active');
      return;
    }
    
    setVotingOptions(prev => ({ ...prev, [optionId]: 'voting' }));
    
    try {
      let optionsToSubmit: string[];
      
      if (!pollData.isMultipleChoiceAllowed) {
        optionsToSubmit = [optionId];
      } else {
        const currentSelected = selectedOptions.includes(optionId);
        if (currentSelected) {
          optionsToSubmit = selectedOptions.filter(id => id !== optionId);
        } else {
          optionsToSubmit = [...selectedOptions, optionId];
        }
      }
      
      const response = await axios.post(`${API_URL}/api/poll/${pollId}/vote`, {
        userId: currentUserId,
        selectedOptions: optionsToSubmit
      });
      
      const updatedPoll = response.data.poll;
      if (typeof updatedPoll.options === 'string') {
        updatedPoll.options = JSON.parse(updatedPoll.options);
      }
      
      setPollData(updatedPoll);
      
      // Update voting states
      const userVotedOptions: string[] = [];
      const votingStates: {[optionId: string]: 'idle' | 'voting' | 'voted'} = {};
      
      if (updatedPoll.votes) {
        Object.keys(updatedPoll.votes).forEach(optId => {
          const voters = updatedPoll.votes![optId] || [];
          if (voters.includes(currentUserId)) {
            userVotedOptions.push(optId);
            votingStates[optId] = 'voted';
          } else {
            votingStates[optId] = 'idle';
          }
        });
      }
      
      updatedPoll.options.forEach((option: PollOption) => {
        if (!votingStates[option.id]) {
          votingStates[option.id] = 'idle';
        }
      });
      
      setSelectedOptions(userVotedOptions);
      setVotingOptions(votingStates);
      
    } catch (error: any) {
      console.error('Error voting:', error);
      const errorMessage = error.response?.data?.error || 'Failed to submit vote';
      Alert.alert('Error', errorMessage);
      setVotingOptions(prev => ({ ...prev, [optionId]: 'idle' }));
    }
  };

  if (loading) {
    return (
      <View style={{ padding: 12, alignItems: 'center' }}>
        <ActivityIndicator size="small" color="#3B82F6" />
        <Text style={{ marginTop: 8, fontSize: 12, color: '#6B7280' }}>Loading poll...</Text>
      </View>
    );
  }

  if (!pollData) {
    return (
      <View style={{ padding: 12 }}>
        <Text style={{ fontSize: 14, color: '#EF4444' }}>Failed to load poll</Text>
      </View>
    );
  }

  const now = new Date();
  const endTime = new Date(pollData.pollEndTime);
  const isPollActive = pollData.isActive && now < endTime;
  const isCreator = pollData.createdBy === currentUserId;

  const getVoteCount = (optionId: string) => {
    return pollData?.votes?.[optionId]?.length || 0;
  };

  const getTotalVotes = () => {
    if (!pollData?.votes) return 0;
    return Object.values(pollData.votes).reduce((sum, voters) => sum + voters.length, 0);
  };

  const getVotePercentage = (optionId: string) => {
    const total = getTotalVotes();
    if (total === 0) return 0;
    return Math.round((getVoteCount(optionId) / total) * 100);
  };

  return (
    <View style={{ paddingVertical: 4 }}>
      {/* Poll Icon */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
        <Ionicons name="bar-chart" size={16} color="#3B82F6" />
        <Text style={{ marginLeft: 4, fontSize: 12, color: '#6B7280', fontWeight: '500' }}>
          Poll
        </Text>
      </View>

      {/* Question */}
      <Text style={{ fontSize: 15, fontWeight: '600', color: '#1F2937', marginBottom: 12 }}>
        {pollData.question}
      </Text>

      {/* Options */}
      <View style={{ gap: 8 }}>
        {pollData.options.map((option) => {
          const voteCount = getVoteCount(option.id);
          const percentage = getVotePercentage(option.id);
          const isSelected = selectedOptions.includes(option.id);
          const votingState = votingOptions[option.id] || 'idle';

          return (
            <TouchableOpacity
              key={option.id}
              onPress={() => handleOptionSelect(option.id)}
              disabled={!isPollActive || votingState === 'voting'}
              style={{
                borderWidth: 1.5,
                borderColor: isSelected ? '#3B82F6' : '#E5E7EB',
                borderRadius: 8,
                padding: 10,
                backgroundColor: isSelected ? '#EFF6FF' : '#F9FAFB',
                opacity: isPollActive ? 1 : 0.6,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                  {/* Radio/Checkbox Icon */}
                  <View style={{
                    width: 18,
                    height: 18,
                    borderRadius: pollData.isMultipleChoiceAllowed ? 4 : 9,
                    borderWidth: 2,
                    borderColor: isSelected ? '#3B82F6' : '#D1D5DB',
                    backgroundColor: isSelected ? '#3B82F6' : 'transparent',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 10,
                  }}>
                    {isSelected && (
                      <Ionicons 
                        name={pollData.isMultipleChoiceAllowed ? "checkmark" : "radio-button-on"} 
                        size={pollData.isMultipleChoiceAllowed ? 12 : 18} 
                        color="white" 
                      />
                    )}
                  </View>
                  
                  {/* Option Text */}
                  <Text style={{
                    flex: 1,
                    fontSize: 14,
                    color: isSelected ? '#1F2937' : '#4B5563',
                    fontWeight: isSelected ? '500' : '400',
                  }}>
                    {option.text}
                  </Text>
                </View>

                {/* Voting Indicator */}
                {votingState === 'voting' && (
                  <ActivityIndicator size="small" color="#3B82F6" style={{ marginLeft: 8 }} />
                )}
                
                {/* Vote Count (for creator only) */}
                {isCreator && (
                  <Text style={{ 
                    fontSize: 12, 
                    color: '#6B7280', 
                    marginLeft: 8,
                    fontWeight: '500' 
                  }}>
                    {voteCount}
                  </Text>
                )}
              </View>

              {/* Progress Bar */}
              {voteCount > 0 && (
                <View style={{
                  height: 4,
                  backgroundColor: '#E5E7EB',
                  borderRadius: 2,
                  marginTop: 8,
                  overflow: 'hidden',
                }}>
                  <View style={{
                    height: '100%',
                    width: `${percentage}%`,
                    backgroundColor: isSelected ? '#3B82F6' : '#93C5FD',
                    borderRadius: 2,
                  }} />
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Status & Actions */}
      <View style={{ marginTop: 12, gap: 8 }}>
        {/* Status Badge */}
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: isPollActive ? '#DCFCE7' : '#FEE2E2',
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 4,
          }}>
            <Ionicons 
              name={isPollActive ? "checkmark-circle" : "close-circle"} 
              size={12} 
              color={isPollActive ? '#059669' : '#DC2626'} 
            />
            <Text style={{
              marginLeft: 4,
              fontSize: 11,
              color: isPollActive ? '#059669' : '#DC2626',
              fontWeight: '500',
            }}>
              {isPollActive ? 'Active' : 'Ended'}
            </Text>
          </View>
          
          {pollData.isMultipleChoiceAllowed && (
            <View style={{
              marginLeft: 8,
              backgroundColor: '#F3F4F6',
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: 4,
            }}>
              <Text style={{ fontSize: 11, color: '#6B7280', fontWeight: '500' }}>
                Multiple Choice
              </Text>
            </View>
          )}
        </View>

        {/* View Results Button (for creator) */}
        {isCreator && (
          <TouchableOpacity
            onPress={() => onViewResults(pollId)}
            style={{
              backgroundColor: '#3B82F6',
              paddingVertical: 8,
              paddingHorizontal: 12,
              borderRadius: 6,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: 'white', fontSize: 13, fontWeight: '600' }}>
              View Results
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

export default PollMessage;