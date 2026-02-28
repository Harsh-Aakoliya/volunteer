import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useLocalSearchParams, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { getPollVotesDetails } from "@/api/chat/polls";
import Svg, { Path } from "react-native-svg";
import BottomSheet, { BottomSheetScrollView } from "@gorhom/bottom-sheet";

const SCREEN_WIDTH = Dimensions.get("window").width;

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

const OPTION_COLORS = [
  "#3b82f6",
  "#ef4444",
  "#22c55e",
  "#f59e0b",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
  "#f97316",
  "#6366f1",
  "#06b6d4",
  "#84cc16",
  "#e11d48",
  "#a855f7",
  "#0ea5e9",
  "#10b981",
  "#d946ef",
  "#eab308",
  "#64748b",
  "#78716c",
  "#2dd4bf",
];

function getColor(index: number) {
  return OPTION_COLORS[index % OPTION_COLORS.length];
}

const Y_AXIS_W = 32;

function computeYAxisTicks(totalMembers: number): number[] {
  totalMembers = 50;
  if (totalMembers <= 0) return [2, 4, 6, 8, 10];
  if (totalMembers <= 10) return [2, 4, 6, 8, 10];
  if (totalMembers <= 50) return [10, 20, 30, 40, 50];
  const upper = Math.ceil(totalMembers / 100) * 100;
  const step = upper / 5;
  return [step, step * 2, step * 3, step * 4, step * 5];
}

// ── Bar Chart ──
function BarChart({
  options,
  totalMembers,
  onOptionSelect,
}: {
  options: PollVotesOption[];
  totalMembers: number;
  onOptionSelect?: (option: PollVotesOption) => void;
}) {
  const yTicks = computeYAxisTicks(totalMembers);
  const maxY = yTicks[yTicks.length - 1];
  const AVAILABLE_W = SCREEN_WIDTH - 92;
  const BAR_AREA_WIDTH = AVAILABLE_W / 3;
  const BAR_WIDTH = Math.min(BAR_AREA_WIDTH * 0.5, 48);
  const CHART_HEIGHT = 200;
  const LABEL_H = 28;
  const scrollContentWidth = BAR_AREA_WIDTH * options.length;

  const scrollOffsetRef = useRef(0);

  const handleBarPress = useCallback(
    (opt: PollVotesOption) => {
      onOptionSelect?.(opt);
    },
    [onOptionSelect]
  );

  return (
    <View>
      <View className="flex-row">
        {/* Y-axis */}
        <View
          style={{ width: Y_AXIS_W, height: CHART_HEIGHT }}
          className="relative"
        >
          <Text
            className="text-[10px] text-gray-400 absolute right-1.5"
            style={{ bottom: -6 }}
          >
            0
          </Text>
          {yTicks.map((tick) => (
            <Text
              key={tick}
              className="text-[10px] text-gray-400 absolute right-1.5"
              style={{ bottom: (tick / maxY) * CHART_HEIGHT - 6 }}
            >
              {tick}
            </Text>
          ))}
        </View>

        {/* Chart body */}
        <View className="flex-1">
          {/* Grid lines */}
          <View
            className="absolute top-0 left-0 right-0"
            style={{ height: CHART_HEIGHT }}
          >
            <View
              className="absolute bottom-0 left-0 right-0"
              style={{ height: 1, backgroundColor: "#d1d5db" }}
            />
            {yTicks.map((tick) => (
              <View
                key={`g-${tick}`}
                className="absolute left-0 right-0"
                style={{
                  bottom: (tick / maxY) * CHART_HEIGHT,
                  height: 0.5,
                  backgroundColor: "#e5e7eb",
                }}
              />
            ))}
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            onScroll={(e) => {
              scrollOffsetRef.current = e.nativeEvent.contentOffset.x;
            }}
            scrollEventThrottle={16}
            contentContainerStyle={{
              width: Math.max(scrollContentWidth, AVAILABLE_W),
              height: CHART_HEIGHT + LABEL_H,
            }}
          >
            <View>
              {/* Bars */}
              <View
                className="flex-row items-end"
                style={{ height: CHART_HEIGHT }}
              >
                {options.map((opt, idx) => {
                  const barH =
                    maxY > 0 ? (opt.voteCount / maxY) * CHART_HEIGHT : 0;
                  const clampedH = Math.max(barH, opt.voteCount > 0 ? 6 : 0);
                  return (
                    <View
                      key={opt.id}
                      style={{ width: BAR_AREA_WIDTH }}
                      className="items-center justify-end"
                    >
                      <Text className="text-[11px] font-bold text-gray-600 mb-0.5">
                        {opt.voteCount}
                      </Text>
                      <TouchableOpacity
                        activeOpacity={0.75}
                        onPress={() => handleBarPress(opt)}
                        style={{
                          width: BAR_WIDTH,
                          height: clampedH,
                          backgroundColor: getColor(idx),
                          borderTopLeftRadius: 6,
                          borderTopRightRadius: 6,
                        }}
                      />
                    </View>
                  );
                })}
              </View>

              {/* X-axis labels (below axis line) */}
              <View
                className="flex-row"
                style={{ height: LABEL_H, paddingTop: 8 }}
              >
                {options.map((opt) => (
                  <View
                    key={`xl-${opt.id}`}
                    style={{ width: BAR_AREA_WIDTH }}
                    className="items-center"
                  >
                    <Text
                      numberOfLines={1}
                      className="text-[10px] text-gray-500 text-center"
                      style={{ maxWidth: BAR_AREA_WIDTH - 6 }}
                    >
                      {opt.text.length > 10
                        ? opt.text.slice(0, 9) + "…"
                        : opt.text}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </View>
  );
}

// ── SVG Pie Chart ──
function PieChartView({
  options,
  totalVotes,
  onOptionSelect,
}: {
  options: PollVotesOption[];
  totalVotes: number;
  onOptionSelect?: (option: PollVotesOption) => void;
}) {
  const PIE_SIZE = Math.min(SCREEN_WIDTH - 80, 220);
  const CENTER = PIE_SIZE / 2;
  const RADIUS = CENTER - 2;
  const INNER_RADIUS = CENTER * 0.32;

  const slices = useMemo(() => {
    if (totalVotes === 0) return [];
    let cumDeg = -90;
    return options
      .map((opt, idx) => {
        const fraction = opt.voteCount / totalVotes;
        const sweep = fraction * 360;
        const s = {
          option: opt,
          startDeg: cumDeg,
          sweepDeg: sweep,
          index: idx,
          fraction,
        };
        cumDeg += sweep;
        return s;
      })
      .filter((s) => s.sweepDeg > 0);
  }, [options, totalVotes]);

  const polarToCartesian = useCallback(
    (angleDeg: number, r: number) => {
      const rad = (angleDeg * Math.PI) / 180;
      return {
        x: CENTER + r * Math.cos(rad),
        y: CENTER + r * Math.sin(rad),
      };
    },
    [CENTER]
  );

  const describeArc = useCallback(
    (startDeg: number, sweepDeg: number) => {
      if (sweepDeg >= 359.99) {
        return [
          `M ${CENTER + RADIUS} ${CENTER}`,
          `A ${RADIUS} ${RADIUS} 0 1 1 ${CENTER - RADIUS} ${CENTER}`,
          `A ${RADIUS} ${RADIUS} 0 1 1 ${CENTER + RADIUS} ${CENTER}`,
          "Z",
        ].join(" ");
      }
      const start = polarToCartesian(startDeg, RADIUS);
      const end = polarToCartesian(startDeg + sweepDeg, RADIUS);
      const largeArc = sweepDeg > 180 ? 1 : 0;
      return [
        `M ${CENTER} ${CENTER}`,
        `L ${start.x} ${start.y}`,
        `A ${RADIUS} ${RADIUS} 0 ${largeArc} 1 ${end.x} ${end.y}`,
        "Z",
      ].join(" ");
    },
    [CENTER, RADIUS, polarToCartesian]
  );

  const handleSlicePress = useCallback(
    (option: PollVotesOption) => {
      onOptionSelect?.(option);
    },
    [onOptionSelect]
  );

  return (
    <View className="items-center">
      {totalVotes === 0 ? (
        <View
          style={{ width: PIE_SIZE, height: PIE_SIZE, borderRadius: CENTER }}
          className="bg-gray-200 items-center justify-center"
        >
          <Text className="text-gray-400 text-sm">No votes</Text>
        </View>
      ) : (
        <View style={{ width: PIE_SIZE, height: PIE_SIZE }}>
          <Svg width={PIE_SIZE} height={PIE_SIZE}>
            {slices.map((s) => (
              <Path
                key={s.option.id}
                d={describeArc(s.startDeg, s.sweepDeg)}
                fill={getColor(s.index)}
                onPress={() => handleSlicePress(s.option)}
              />
            ))}
          </Svg>
          {/* Donut center overlay */}
          <View
            style={{
              position: "absolute",
              top: CENTER - INNER_RADIUS,
              left: CENTER - INNER_RADIUS,
              width: INNER_RADIUS * 2,
              height: INNER_RADIUS * 2,
              borderRadius: INNER_RADIUS,
              backgroundColor: "#f9fafb",
            }}
            className="items-center justify-center"
          >
            <Text className="text-[15px] font-bold text-gray-700">
              {totalVotes}
            </Text>
            <Text className="text-[9px] text-gray-400">votes</Text>
          </View>
        </View>
      )}

      {/* Percentage badges */}
      <View className="flex-row flex-wrap justify-center mt-3.5 gap-1.5">
        {options.map((opt, idx) => {
          const pct =
            totalVotes > 0
              ? Math.round((opt.voteCount / totalVotes) * 100)
              : 0;
          return (
            <TouchableOpacity
              key={opt.id}
              activeOpacity={0.7}
              onPress={() => {
                if (opt.voteCount > 0) handleSlicePress(opt);
              }}
              style={{ backgroundColor: getColor(idx) + "15" }}
              className="flex-row items-center px-2.5 py-1 rounded-full"
            >
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: getColor(idx),
                }}
                className="mr-1.5"
              />
              <Text
                style={{ color: getColor(idx) }}
                className="text-[12px] font-bold"
              >
                {pct}%
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// ── Color Legend (aligned with bar chart Y-axis) ──
function ColorLegend({ options }: { options: PollVotesOption[] }) {
  return (
    <View
      className="flex-row flex-wrap gap-x-3 gap-y-1.5 mb-3"
      style={{ paddingLeft: Y_AXIS_W }}
    >
      {options.map((opt, idx) => (
        <View key={opt.id} className="flex-row items-center">
          <View
            style={{
              width: 10,
              height: 10,
              borderRadius: 5,
              backgroundColor: getColor(idx),
            }}
            className="mr-1.5"
          />
          <Text
            numberOfLines={1}
            className="text-[11px] text-gray-600 max-w-[100px]"
          >
            {opt.text}
          </Text>
        </View>
      ))}
    </View>
  );
}

// ── Main Screen ──
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
  const [showStats, setShowStats] = useState(false);
  const [selectedOptionInStats, setSelectedOptionInStats] =
    useState<PollVotesOption | null>(null);
  const [showAllForSelected, setShowAllForSelected] = useState(false);

  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ["50%", "90%"], []);

  const fetchData = useCallback(async () => {
    if (!Number.isFinite(pollIdNum)) return;
    const data = await getPollVotesDetails(pollIdNum, currentUserId || "");
    setData(data);
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

  const totalVotes = useMemo(
    () => (data ? data.options.reduce((s, o) => s + o.voteCount, 0) : 0),
    [data]
  );

  const handleStatsOptionSelect = useCallback((option: PollVotesOption) => {
    setSelectedOptionInStats(option);
    setShowAllForSelected(false);
  }, []);

  useEffect(() => {
    if (selectedOptionInStats) {
      bottomSheetRef.current?.snapToIndex(0);
    }
  }, [selectedOptionInStats]);

  const handleSheetChange = useCallback((index: number) => {
    if (index === -1) {
      setSelectedOptionInStats(null);
    }
  }, []);

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
        <Text className="text-red-600 font-semibold">
          Failed to load poll votes
        </Text>
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
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
      >
        <Text className="text-xl font-semibold text-gray-900">
          {data.poll.question}
        </Text>

        {/* Voted count + toggle */}
        <View className="flex-row items-center justify-between mt-2">
          <Text className="text-sm text-gray-600">
            {data.votedMembers} of {totalMembersNum} voted
          </Text>

          <TouchableOpacity
            onPress={() => setShowStats((p) => !p)}
            activeOpacity={0.7}
            className={`flex-row items-center px-3.5 py-1.5 rounded-full gap-x-1.5 ${
              showStats ? "bg-sky-600" : "bg-gray-100"
            }`}
          >
            <Ionicons
              name={showStats ? "list-outline" : "stats-chart"}
              size={16}
              color={showStats ? "#fff" : "#374151"}
            />
            <Text
              className={`text-[13px] font-semibold ${
                showStats ? "text-white" : "text-gray-700"
              }`}
            >
              {showStats ? "Options" : "Statistics"}
            </Text>
          </TouchableOpacity>
        </View>

        <View className="mt-4">
          {showStats ? (
            /* ── STATISTICS VIEW ── */
            <View style={{ marginLeft: -8 }}>
              {/* Color Legend aligned with chart body */}
              <ColorLegend options={data.options} />

              {/* Bar Chart */}
              <View
                className="bg-gray-50 rounded-2xl mb-4 border border-gray-100"
                style={{ paddingLeft: 8, paddingRight: 14, paddingTop: 14, paddingBottom: 14 }}
              >
                <BarChart
                  options={data.options}
                  totalMembers={totalMembersNum}
                  onOptionSelect={handleStatsOptionSelect}
                />
              </View>

              {/* Pie Chart */}
              <View className="bg-gray-50 rounded-2xl p-3.5 border border-gray-100 items-center">
                <PieChartView
                  options={data.options}
                  totalVotes={totalVotes}
                  onOptionSelect={handleStatsOptionSelect}
                />
              </View>
            </View>
          ) : (
            /* ── OPTIONS LIST VIEW ── */
            <View>
              {data.options.map((opt, idx) => {
                const isExpanded = !!expanded[opt.id];
                const showAllForOpt = !!showAll[opt.id];
                const visibleVoters = isExpanded
                  ? opt.voters.slice(
                      0,
                      showAllForOpt
                        ? opt.voters.length
                        : Math.min(4, opt.voters.length)
                    )
                  : [];
                const canViewMore = opt.voters.length > 4;

                return (
                  <View
                    key={opt.id}
                    className="rounded-xl mb-3 overflow-hidden"
                    style={{
                      borderWidth: 1,
                      borderColor: "#e5e7eb",
                      borderLeftWidth: 3,
                      borderLeftColor: getColor(idx),
                    }}
                  >
                    <TouchableOpacity
                      onPress={() =>
                        setExpanded((p) => ({ ...p, [opt.id]: !p[opt.id] }))
                      }
                      className="px-4 py-3 bg-gray-50 flex-row items-center"
                      activeOpacity={0.8}
                    >
                      <View
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: 5,
                          backgroundColor: getColor(idx),
                          marginRight: 10,
                        }}
                      />
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
                          <Text className="text-sm text-gray-500">
                            No votes yet
                          </Text>
                        ) : (
                          <View className="gap-3">
                            {visibleVoters.map((v) => (
                              <View
                                key={`${opt.id}-${v.userId}`}
                                className="border-b border-gray-100 pb-3"
                              >
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
                                  setShowAll((p) => ({
                                    ...p,
                                    [opt.id]: !p[opt.id],
                                  }))
                                }
                                className="py-1"
                              >
                                <Text className="text-[14px] font-semibold text-sky-600">
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
          )}
        </View>
      </ScrollView>

      {/* Bottom sheet: voters for selected option (bar/pie tap) */}
      <BottomSheet
        ref={bottomSheetRef}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose
        onChange={handleSheetChange}
        handleIndicatorStyle={{ backgroundColor: "#d1d5db", width: 36, height: 4 }}
        backgroundStyle={{ backgroundColor: "#fff" }}
      >
        {selectedOptionInStats && (
          <View className="flex-1 px-4 pb-6">
            <View
              className="flex-row items-center rounded-xl py-3 px-3 mb-3"
              style={{
                borderLeftWidth: 4,
                borderLeftColor: getColor(
                  data.options.findIndex((o) => o.id === selectedOptionInStats.id)
                ),
                backgroundColor: "#f9fafb",
              }}
            >
              <View className="flex-1 mr-2">
                <Text className="text-[16px] font-semibold text-gray-900" numberOfLines={2}>
                  {selectedOptionInStats.text}
                </Text>
                <Text className="text-[13px] text-gray-500 mt-0.5">
                  {selectedOptionInStats.voteCount} vote{selectedOptionInStats.voteCount !== 1 ? "s" : ""}
                </Text>
              </View>
            </View>
            <Text className="text-[14px] font-semibold text-gray-700 mb-2">Voters</Text>
            <BottomSheetScrollView
              contentContainerStyle={{ paddingBottom: 24 }}
              showsVerticalScrollIndicator={false}
            >
              {selectedOptionInStats.voters.length === 0 ? (
                <Text className="text-sm text-gray-500">No votes yet</Text>
              ) : (
                <View className="gap-2">
                  {(showAllForSelected
                    ? selectedOptionInStats.voters
                    : selectedOptionInStats.voters.slice(0, 4)
                  ).map((v) => (
                    <View
                      key={`${selectedOptionInStats.id}-${v.userId}`}
                      className="py-2.5 border-b border-gray-100"
                    >
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
                  {selectedOptionInStats.voters.length > 4 && (
                    <TouchableOpacity
                      onPress={() => setShowAllForSelected((p) => !p)}
                      className="py-3"
                    >
                      <Text className="text-[14px] font-semibold text-sky-600">
                        {showAllForSelected ? "Show less" : "View more"}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </BottomSheetScrollView>
          </View>
        )}
      </BottomSheet>
    </View>
  );
}
