// import React, { useState, useEffect, useRef, useMemo } from 'react';
// import {
//   View,
//   Text,
//   Pressable,
//   ScrollView,
//   PanResponder,
//   ActivityIndicator,
// } from 'react-native';
// import { Audio, AVPlaybackStatus } from 'expo-av';
// import { Ionicons } from '@expo/vector-icons';

// const SPEEDS = [1.0, 1.5, 2.0] as const;

// const SPIKES_PER_SECOND = 2;
// const BAR_W = 3;
// const BAR_GAP = 3;
// const BAR_STEP = BAR_W + BAR_GAP;
// const H_PAD = 10;
// const ROW_HEIGHT = 40;   // single horizontal centerline for all elements
// const BALL_D = 16;
// const BALL_HIT = 44;

// interface Props {
//   audioUrl: string;
//   durationSeconds?: number;
//   isOwnMessage?: boolean;
// }

// function formatTime(ms: number): string {
//   const t = Math.floor(Number(ms) / 1000) || 0;
//   return `${Math.floor(t / 60)}:${(t % 60).toString().padStart(2, '0')}`;
// }

// function clamp(v: number, lo: number, hi: number) {
//   return Math.max(lo, Math.min(hi, v));
// }

// export default function AudioMessagePlayer({
//   audioUrl,
//   durationSeconds = 0,
//   isOwnMessage = false,
// }: Props) {
//   const soundRef = useRef<Audio.Sound | null>(null);
//   const scrollRef = useRef<ScrollView>(null);
//   const visibleW = useRef(180);

//   const [isPlaying, setIsPlaying] = useState(false);
//   const [loading, setLoading] = useState(false);
//   const [error, setError] = useState(false);
//   const [durationMs, setDurationMs] = useState(durationSeconds * 1000);
//   const [positionMs, setPositionMs] = useState(0);
//   const [speedIndex, setSpeedIndex] = useState(0);

//   const speed = SPEEDS[speedIndex];
//   const isSeekingRef = useRef(false);
//   const durationRef = useRef(0);
//   const barCountRef = useRef(40);
//   const speedRef = useRef(1);

//   durationRef.current = durationMs;
//   speedRef.current = speed;

//   /* ── waveform ───────────────────── */
//   const barCount = useMemo(() => {
//     if (!durationMs) return 40;
//     return Math.max(6, Math.ceil((durationMs / 1000) * SPIKES_PER_SECOND));
//   }, [durationMs]);

//   barCountRef.current = barCount;

//   const bars = useMemo(() => {
//     let x = audioUrl.length % 997;
//     return Array.from({ length: barCount }, () => {
//       x = (x * 271 + 97) % 997;
//       return clamp(6 + Math.floor((x / 997) * 22), 6, 30);
//     });
//   }, [barCount, audioUrl]);

//   const ratio = durationMs ? positionMs / durationMs : 0;
//   const activeIndex = Math.floor(ratio * barCount);
//   const ballCx = H_PAD + activeIndex * BAR_STEP + BAR_W / 2;
//   const contentWidth = H_PAD * 2 + barCount * BAR_STEP;

//   /* ── auto scroll ───────────────── */
//   useEffect(() => {
//     const target = clamp(
//       ballCx - visibleW.current / 2,
//       0,
//       Math.max(0, contentWidth - visibleW.current)
//     );
//     scrollRef.current?.scrollTo({ x: target, animated: true });
//   }, [ballCx, contentWidth]);

//   /* ── seeking ───────────────────── */
//   const panResponder = useMemo(
//     () =>
//       PanResponder.create({
//         onStartShouldSetPanResponder: () => true,
//         onPanResponderGrant: async () => {
//           isSeekingRef.current = true;
//           await soundRef.current?.pauseAsync();
//           setIsPlaying(false);
//         },
//         onPanResponderMove: (_, g) => {
//           const dur = durationRef.current;
//           const px = barCountRef.current * BAR_STEP;
//           const msPerPx = dur / px;
//           setPositionMs(clamp(g.dx * msPerPx + positionMs, 0, dur));
//         },
//         onPanResponderRelease: async () => {
//           isSeekingRef.current = false;
//           if (!soundRef.current) return;
//           await soundRef.current.setPositionAsync(positionMs);
//           await soundRef.current.setRateAsync(speedRef.current, true);
//           await soundRef.current.playAsync();
//           setIsPlaying(true);
//         },
//       }),
//     [positionMs]
//   );

//   /* ── load audio ────────────────── */
//   useEffect(() => {
//     let mounted = true;

//     async function load() {
//       try {
//         setLoading(true);
//         const { sound } = await Audio.Sound.createAsync(
//           { uri: audioUrl },
//           { shouldPlay: false, progressUpdateIntervalMillis: 100 }
//         );

//         soundRef.current = sound;

//         sound.setOnPlaybackStatusUpdate(async (st: AVPlaybackStatus) => {
//           if (!mounted || !st.isLoaded) return;

//           setDurationMs(st.durationMillis ?? 0);
//           if (!isSeekingRef.current) {
//             setPositionMs(st.positionMillis ?? 0);
//           }

//           if (st.didJustFinish) {
//             await sound.pauseAsync();
//             await sound.setPositionAsync(0);
//             setIsPlaying(false);
//             setPositionMs(0);
//             scrollRef.current?.scrollTo({ x: 0, animated: true });
//           }
//         });
//       } catch {
//         setError(true);
//       } finally {
//         setLoading(false);
//       }
//     }

//     load();
//     return () => {
//       mounted = false;
//       soundRef.current?.unloadAsync();
//     };
//   }, [audioUrl]);

//   /* ── controls ─────────────────── */
//   async function togglePlayPause() {
//     if (!soundRef.current) return;
//     const st = await soundRef.current.getStatusAsync();
//     if (!st.isLoaded) return;

//     if (st.isPlaying) {
//       await soundRef.current.pauseAsync();
//       setIsPlaying(false);
//     } else {
//       await soundRef.current.setRateAsync(speed, true);
//       await soundRef.current.playAsync();
//       setIsPlaying(true);
//     }
//   }

//   function cycleSpeed() {
//     const next = (speedIndex + 1) % SPEEDS.length;
//     setSpeedIndex(next);
//     soundRef.current?.setRateAsync(SPEEDS[next], true);
//   }

//   const playedColor = isOwnMessage ? '#1E6F5C' : '#0088CC';
//   const unplayedColor = '#A0B4C0';
//   const bubbleBg = isOwnMessage ? 'bg-[#DCF8C6]' : 'bg-white';

//   return (
//     <View className={`rounded-2xl px-3 py-2 w-[260px] ${bubbleBg}`}>
//       {/* Single row: all aligned on horizontal centerline (ROW_HEIGHT) */}
//       <View
//         style={{ height: ROW_HEIGHT, flexDirection: 'row', alignItems: 'center' }}
//       >
//         {/* LEFT: speed + play — centered on same line */}
//         <View style={{ width: '30%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
//           <Pressable
//             onPress={cycleSpeed}
//             style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: 'rgba(0,0,0,0.28)' }}
//           >
//             <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>{`${speed}x`}</Text>
//           </Pressable>
//           <Pressable onPress={togglePlayPause} style={{ alignItems: 'center', justifyContent: 'center' }}>
//             {loading ? (
//               <ActivityIndicator size="small" />
//             ) : (
//               <Ionicons name={isPlaying ? 'pause' : 'play'} size={28} color="#000" />
//             )}
//           </Pressable>
//         </View>

//         {/* RIGHT: waveform + ball — bars and ball center on same line */}
//         <View
//           style={{ flex: 1, marginLeft: 8, height: ROW_HEIGHT, justifyContent: 'center' }}
//           onLayout={(e) => (visibleW.current = e.nativeEvent.layout.width)}
//         >
//           <ScrollView ref={scrollRef} horizontal scrollEnabled={false} showsHorizontalScrollIndicator={false}>
//             <View style={{ width: contentWidth, height: ROW_HEIGHT, justifyContent: 'center' }}>
//               <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', paddingHorizontal: H_PAD, height: ROW_HEIGHT }}>
//                 {bars.map((h, i) => (
//                   <View
//                     key={i}
//                     style={{
//                       width: BAR_W,
//                       height: h,
//                       marginRight: BAR_GAP,
//                       borderRadius: 2,
//                       backgroundColor: i < activeIndex ? playedColor : unplayedColor,
//                     }}
//                   />
//                 ))}
//               </View>
//               {/* Ball: center aligned with bars (both use ROW_HEIGHT) */}
//               <View
//                 {...panResponder.panHandlers}
//                 style={{
//                   position: 'absolute',
//                   left: ballCx - BALL_HIT / 2,
//                   top: ROW_HEIGHT / 2 - BALL_HIT / 2,
//                   width: BALL_HIT,
//                   height: BALL_HIT,
//                   alignItems: 'center',
//                   justifyContent: 'center',
//                 }}
//               >
//                 <View
//                   style={{
//                     width: BALL_D,
//                     height: BALL_D,
//                     borderRadius: BALL_D / 2,
//                     backgroundColor: playedColor,
//                     borderWidth: 2,
//                     borderColor: '#fff',
//                   }}
//                 />
//               </View>
//             </View>
//           </ScrollView>
//         </View>
//       </View>

//       {/* Time row — below the main aligned row */}
//       <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4, marginTop: 2 }}>
//         <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}></View> {/* empty view to center the time text */}
//         <Text style={{ fontSize: 11, color: 'rgba(0,0,0,0.6)' }}>{formatTime(positionMs ?? 0)}</Text>
//         <Text style={{ fontSize: 11, color: 'rgba(0,0,0,0.6)' }}>{formatTime(durationMs ?? 0)}</Text>
//       </View>

//       {error && <Text className="text-red-600 text-xs mt-1">Failed to load</Text>}
//     </View>
//   );
// }




import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  PanResponder,
  ActivityIndicator,
} from 'react-native';
import { Audio, AVPlaybackStatus } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';

const SPEEDS = [1.0, 1.5, 2.0] as const;

const SPIKES_PER_SECOND = 2;
const BAR_W = 3;
const BAR_GAP = 3;
const BAR_STEP = BAR_W + BAR_GAP;
const H_PAD = 10;
const ROW_HEIGHT = 40;   
const BALL_D = 16;
const BALL_HIT = 44;

interface Props {
  audioUrl: string;
  durationSeconds?: number;
  isOwnMessage?: boolean;
}

function formatTime(ms: number): string {
  const t = Math.floor(Number(ms) / 1000) || 0;
  return `${Math.floor(t / 60)}:${(t % 60).toString().padStart(2, '0')}`;
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

export default function AudioMessagePlayer({
  audioUrl,
  durationSeconds = 0,
  isOwnMessage = false,
}: Props) {
  const soundRef = useRef<Audio.Sound | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const visibleW = useRef(180);

  const [isPlaying, setIsPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [durationMs, setDurationMs] = useState(durationSeconds * 1000);
  const [positionMs, setPositionMs] = useState(0);
  const [speedIndex, setSpeedIndex] = useState(0);

  const speed = SPEEDS[speedIndex];
  const isSeekingRef = useRef(false);
  const durationRef = useRef(0);
  const barCountRef = useRef(40);
  const speedRef = useRef(1);

  durationRef.current = durationMs;
  speedRef.current = speed;

  /* ── waveform ───────────────────── */
  const barCount = useMemo(() => {
    if (!durationMs) return 40;
    return Math.max(6, Math.ceil((durationMs / 1000) * SPIKES_PER_SECOND));
  }, [durationMs]);

  barCountRef.current = barCount;

  const bars = useMemo(() => {
    let x = audioUrl.length % 997;
    return Array.from({ length: barCount }, () => {
      x = (x * 271 + 97) % 997;
      return clamp(6 + Math.floor((x / 997) * 22), 6, 30);
    });
  }, [barCount, audioUrl]);

  const ratio = durationMs ? positionMs / durationMs : 0;
  const activeIndex = Math.floor(ratio * barCount);
  const ballCx = H_PAD + activeIndex * BAR_STEP + BAR_W / 2;
  const contentWidth = H_PAD * 2 + barCount * BAR_STEP;

  /* ── auto scroll ───────────────── */
  useEffect(() => {
    const target = clamp(
      ballCx - visibleW.current / 2,
      0,
      Math.max(0, contentWidth - visibleW.current)
    );
    scrollRef.current?.scrollTo({ x: target, animated: true });
  }, [ballCx, contentWidth]);

  /* ── seeking ───────────────────── */
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderGrant: async () => {
          isSeekingRef.current = true;
          await soundRef.current?.pauseAsync();
          setIsPlaying(false);
        },
        onPanResponderMove: (_, g) => {
          const dur = durationRef.current;
          const px = barCountRef.current * BAR_STEP;
          const msPerPx = dur / px;
          // Ensure we don't set state with NaN
          const newPos = clamp(g.dx * msPerPx + positionMs, 0, dur);
          setPositionMs(newPos);
        },
        onPanResponderRelease: async () => {
          isSeekingRef.current = false;
          if (!soundRef.current) return;
          await soundRef.current.setPositionAsync(positionMs);
          await soundRef.current.setRateAsync(speedRef.current, true);
          await soundRef.current.playAsync();
          setIsPlaying(true);
        },
      }),
    [positionMs]
  );

  /* ── load audio ────────────────── */
  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        setLoading(true);
        const { sound } = await Audio.Sound.createAsync(
          { uri: audioUrl },
          { shouldPlay: false, progressUpdateIntervalMillis: 100 }
        );

        soundRef.current = sound;

        sound.setOnPlaybackStatusUpdate(async (st: AVPlaybackStatus) => {
          if (!mounted || !st.isLoaded) return;

          setDurationMs(st.durationMillis ?? 0);
          if (!isSeekingRef.current) {
            setPositionMs(st.positionMillis ?? 0);
          }

          if (st.didJustFinish) {
            await sound.pauseAsync();
            await sound.setPositionAsync(0);
            setIsPlaying(false);
            setPositionMs(0);
            scrollRef.current?.scrollTo({ x: 0, animated: true });
          }
        });
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
      soundRef.current?.unloadAsync();
    };
  }, [audioUrl]);

  /* ── controls ─────────────────── */
  async function togglePlayPause() {
    if (!soundRef.current) return;
    const st = await soundRef.current.getStatusAsync();
    if (!st.isLoaded) return;

    if (st.isPlaying) {
      await soundRef.current.pauseAsync();
      setIsPlaying(false);
    } else {
      await soundRef.current.setRateAsync(speed, true);
      await soundRef.current.playAsync();
      setIsPlaying(true);
    }
  }

  function cycleSpeed() {
    const next = (speedIndex + 1) % SPEEDS.length;
    setSpeedIndex(next);
    soundRef.current?.setRateAsync(SPEEDS[next], true);
  }

  const playedColor = isOwnMessage ? '#1E6F5C' : '#0088CC';
  const unplayedColor = '#A0B4C0';
  const bubbleBg = isOwnMessage ? 'bg-[#DCF8C6]' : 'bg-white';

  return (
    <View className={`rounded-2xl px-3 py-2 w-[260px] ${bubbleBg}`}>
      {/* Single row: all aligned on horizontal centerline (ROW_HEIGHT) */}
      <View
        style={{ height: ROW_HEIGHT, flexDirection: 'row', alignItems: 'center' }}
      >
        {/* LEFT: speed + play — centered on same line */}
        <View style={{ width: '30%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          <Pressable
            onPress={cycleSpeed}
            style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: 'rgba(0,0,0,0.28)' }}
          >
            {/* FIXED: String wrapped in Text component */}
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>
              {`${speed}x`}
            </Text>
          </Pressable>
          <Pressable onPress={togglePlayPause} style={{ alignItems: 'center', justifyContent: 'center' }}>
            {loading ? (
              <ActivityIndicator size="small" />
            ) : (
              <Ionicons name={isPlaying ? 'pause' : 'play'} size={28} color="#000" />
            )}
          </Pressable>
        </View>

        {/* RIGHT: waveform + ball — bars and ball center on same line */}
        <View
          style={{ flex: 1, marginLeft: 8, height: ROW_HEIGHT, justifyContent: 'center' }}
          onLayout={(e) => (visibleW.current = e.nativeEvent.layout.width)}
        >
          <ScrollView ref={scrollRef} horizontal scrollEnabled={false} showsHorizontalScrollIndicator={false}>
            <View style={{ width: contentWidth, height: ROW_HEIGHT, justifyContent: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', paddingHorizontal: H_PAD, height: ROW_HEIGHT }}>
                {bars.map((h, i) => (
                  <View
                    key={i}
                    style={{
                      width: BAR_W,
                      height: h,
                      marginRight: BAR_GAP,
                      borderRadius: 2,
                      backgroundColor: i < activeIndex ? playedColor : unplayedColor,
                    }}
                  />
                ))}
              </View>
              {/* Ball: center aligned with bars (both use ROW_HEIGHT) */}
              <View
                {...panResponder.panHandlers}
                style={{
                  position: 'absolute',
                  left: ballCx - BALL_HIT / 2,
                  top: ROW_HEIGHT / 2 - BALL_HIT / 2,
                  width: BALL_HIT,
                  height: BALL_HIT,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <View
                  style={{
                    width: BALL_D,
                    height: BALL_D,
                    borderRadius: BALL_D / 2,
                    backgroundColor: playedColor,
                    borderWidth: 2,
                    borderColor: '#fff',
                  }}
                />
              </View>
            </View>
          </ScrollView>
        </View>
      </View>

      {/* Time row — below the main aligned row */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}></View> 
        {/* Ensuring these are definitely Text components */}
        <Text style={{ fontSize: 11, color: 'rgba(0,0,0,0.6)' }}>{formatTime(positionMs)}</Text>
        <Text style={{ fontSize: 11, color: 'rgba(0,0,0,0.6)' }}>{formatTime(durationMs)}</Text>
      </View>

      {error && <Text style={{ color: '#dc2626', fontSize: 12, marginTop: 4 }}>Failed to load</Text>}
    </View>
  );
}