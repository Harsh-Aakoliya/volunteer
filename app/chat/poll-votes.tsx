import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useLocalSearchParams, router } from "expo-router";
import axios from "axios";
import { Ionicons } from "@expo/vector-icons";
import { API_URL } from "@/constants/api";

type VoteUser = {
  userId: string;
  fullName: string;
  votedAt: string | null;
};

type PollVotesOption = {
  id: string;
  text: string;
  voteCount: number;
  voters: VoteUser[];
};

type PollVotesResponse = {
  poll: {
    id: number;
    question: string;
    isMultipleChoiceAllowed: boolean;
    createdBy: string;
    roomId: number;
    createdAt: string;
  };
  votedMembers: number;
  options: PollVotesOption[];
};

function formatVotedAt(votedAt: string | null) {
  if (!votedAt) return "";
  try {
    return new Date(votedAt).toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export default function PollVotesScreen() {
  const { pollId, totalMembers, currentUserId } = useLocalSearchParams<{
    pollId?: string;
    totalMembers?: string;
    currentUserId?: string;
  }>();

  const pollIdNum = useMemo(() => (pollId ? Number(pollId) : NaN), [pollId]);
  const totalMembersNum = useMemo(
    () => (totalMembers ? Number(totalMembers) : 0),
    [totalMembers]
  );

  const [data, setData] = useState<PollVotesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [showAll, setShowAll] = useState<Record<string, boolean>>({});

  const fetchData = useCallback(async () => {
    if (!Number.isFinite(pollIdNum)) return;
    const response = await axios.get(`${API_URL}/api/poll/${pollIdNum}/votes-details`, {
      params: { userId: currentUserId || "" },
    });
    setData(response.data);
  }, [pollIdNum, currentUserId]);

  const initialLoad = useCallback(async () => {
    try {
      setLoading(true);
      await fetchData();
    } finally {
      setLoading(false);
    }
  }, [fetchData]);

  useFocusEffect(
    useCallback(() => {
      initialLoad();
    }, [initialLoad])
  );

  const onRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      await fetchData();
    } finally {
      setRefreshing(false);
    }
  }, [fetchData]);

  if (loading) {
    return (
      <View className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator size="large" color="#0284c7" />
        <Text className="text-gray-500 mt-2">Loading votes…</Text>
      </View>
    );
  }

  if (!data) {
    return (
      <View className="flex-1 bg-white items-center justify-center px-6">
        <Text className="text-red-600 font-semibold">Failed to load poll votes</Text>
        <TouchableOpacity
          onPress={() => router.back()}
          className="mt-4 bg-gray-200 px-4 py-2 rounded-lg"
        >
          <Text className="text-gray-800 font-semibold">Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white">
      {/* Header */}
      <View className="flex-row items-center px-3 py-3 border-b border-gray-200">
        <TouchableOpacity onPress={() => router.back()} className="p-2">
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text className="text-[17px] font-semibold text-gray-900 ml-1">
          Poll votes
        </Text>
        <View className="flex-1" />
        <TouchableOpacity onPress={onRefresh} className="p-2">
          <Ionicons name="refresh" size={22} color="#111827" />
        </TouchableOpacity>
      </View>

      <ScrollView
        className="flex-1"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
      >
        <Text className="text-xl font-semibold text-gray-900">
          {data.poll.question}
        </Text>

        <Text className="text-sm text-gray-600 mt-2">
          {data.votedMembers} of {totalMembersNum} voted
        </Text>

        <View className="mt-4">
          {data.options.map((opt) => {
            const isExpanded = !!expanded[opt.id];
            const showAllForOpt = !!showAll[opt.id];
            const visibleVoters = isExpanded
              ? opt.voters.slice(0, showAllForOpt ? opt.voters.length : Math.min(4, opt.voters.length))
              : [];
            const canViewMore = opt.voters.length > 4;

            return (
              <View
                key={opt.id}
                className="border border-gray-200 rounded-xl mb-3 overflow-hidden"
              >
                <TouchableOpacity
                  onPress={() =>
                    setExpanded((p) => ({ ...p, [opt.id]: !p[opt.id] }))
                  }
                  className="px-4 py-3 bg-gray-50 flex-row items-center"
                  activeOpacity={0.8}
                >
                  <View className="flex-1">
                    <Text className="text-[15px] font-semibold text-gray-900">
                      {opt.text}
                    </Text>
                  </View>
                  <Text className="text-[14px] font-semibold text-gray-900 mr-2">
                    {opt.voteCount}
                  </Text>
                  <Ionicons
                    name={isExpanded ? "chevron-up" : "chevron-forward"}
                    size={18}
                    color="#111827"
                  />
                </TouchableOpacity>

                {isExpanded && (
                  <View className="px-4 py-3 bg-white">
                    {visibleVoters.length === 0 ? (
                      <Text className="text-sm text-gray-500">No votes yet</Text>
                    ) : (
                      <View className="gap-3">
                        {visibleVoters.map((v) => (
                          <View key={`${opt.id}-${v.userId}`} className="border-b border-gray-100 pb-3">
                            <Text className="text-[14px] font-semibold text-gray-900">
                              {v.fullName || v.userId}
                            </Text>
                            {!!formatVotedAt(v.votedAt) && (
                              <Text className="text-[12px] text-gray-500 mt-0.5">
                                {formatVotedAt(v.votedAt)}
                              </Text>
                            )}
                          </View>
                        ))}

                        {canViewMore && (
                          <TouchableOpacity
                            onPress={() =>
                              setShowAll((p) => ({ ...p, [opt.id]: !p[opt.id] }))
                            }
                            className="py-1"
                          >
                            <Text className="text-[14px] font-semibold text-[#0284c7]">
                              {showAllForOpt ? "Show less" : "View more"}
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    )}
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

