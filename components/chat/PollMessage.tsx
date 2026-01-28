// components/chat/PollMessage.tsx
import React, { useMemo, useState, useEffect } from 'react';
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
import { useWindowDimensions } from 'react-native';

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
  onViewResults: (pollId: number) => void;
};

const PollMessage = ({ pollId, currentUserId, onViewResults }: Props) => {
  const { width: windowWidth } = useWindowDimensions();
  const [pollData, setPollData] = useState<PollData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [votingOptions, setVotingOptions] = useState<{[optionId: string]: 'idle' | 'voting' | 'voted'}>({});

  const cardWidth = useMemo(() => {
    const w = Math.round(windowWidth * 0.5);
    // Keep a sane minimum for small devices
    return Math.max(220, w);
  }, [windowWidth]);

  const deriveUserVotes = (votes: any): string[] => {
    if (!votes || typeof votes !== "object") return [];
    const picked: string[] = [];
    Object.keys(votes).forEach((optionId) => {
      const arr = votes[optionId] || [];
      // legacy: string[]
      if (Array.isArray(arr) && arr.some((v) => String(v) === String(currentUserId))) {
        picked.push(optionId);
        return;
      }
      // new: {userId, votedAt}[]
      if (Array.isArray(arr) && arr.some((v) => v && typeof v === "object" && String(v.userId) === String(currentUserId))) {
        picked.push(optionId);
      }
    });
    return picked;
  };

  const fetchPollData = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/poll/${pollId}`);
      const data = response.data.polldata;
      setPollData(data);
      
      // Initialize voting states
      const userVotedOptions: string[] = deriveUserVotes(data.votes);
      const votingStates: {[optionId: string]: 'idle' | 'voting' | 'voted'} = {};
      
      if (data.votes) {
        Object.keys(data.votes).forEach(optionId => {
          const voters = data.votes![optionId] || [];
          const didVote =
            Array.isArray(voters) &&
            (voters.some((v) => String(v) === String(currentUserId)) ||
              voters.some((v) => v && typeof v === "object" && String(v.userId) === String(currentUserId)));
          if (didVote) {
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
        // Allow un-vote for single-choice by tapping selected option again
        const currentSelected = selectedOptions.includes(optionId);
        optionsToSubmit = currentSelected ? [] : [optionId];
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
      const userVotedOptions: string[] = deriveUserVotes(updatedPoll.votes);
      const votingStates: {[optionId: string]: 'idle' | 'voting' | 'voted'} = {};
      
      if (updatedPoll.votes) {
        Object.keys(updatedPoll.votes).forEach(optId => {
          const voters = updatedPoll.votes![optId] || [];
          const didVote =
            Array.isArray(voters) &&
            (voters.some((v) => String(v) === String(currentUserId)) ||
              voters.some((v) => v && typeof v === "object" && String(v.userId) === String(currentUserId)));
          if (didVote) {
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
  const isCreator = String(pollData.createdBy) === String(currentUserId);

  return (
    <View style={{ paddingVertical: 4, width: cardWidth }}>
      {/* Poll Icon */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
        <Ionicons name="bar-chart" size={16} color="#3B82F6" />
        <Text style={{ marginLeft: 4, fontSize: 12, color: '#6B7280', fontWeight: '500' }}>
          Poll
        </Text>
      </View>

      {/* Question */}
      <Text style={{ fontSize: 15, fontWeight: '600', color: '#1F2937', marginBottom: 6 }}>
        {pollData.question}
      </Text>
      <Text style={{ fontSize: 12, color: '#6B7280', marginBottom: 12 }}>
        {pollData.isMultipleChoiceAllowed ? 'Select one or more' : 'Select one'}
      </Text>

      {/* Options */}
      <View style={{ gap: 8 }}>
        {pollData.options.map((option) => {
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
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Status & Actions */}
      <View style={{ marginTop: 12, gap: 8 }}>
        {/* View votes (for creator only) */}
        {isCreator && (
          <TouchableOpacity
            onPress={() => onViewResults(pollId)}
            style={{
              alignItems: 'center',
              paddingVertical: 10,
            }}
          >
            <Text style={{ color: '#16A34A', fontSize: 16, fontWeight: '700' }}>
              View votes
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

export default PollMessage;