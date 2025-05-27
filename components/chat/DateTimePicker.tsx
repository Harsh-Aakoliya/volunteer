// components/DateTimePicker.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Modal,
  ScrollView,
  TouchableWithoutFeedback,
} from 'react-native';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isBefore,
  isSameDay,
  getDay,
  setMonth,
  setYear,
} from 'date-fns';

interface DateTimePickerProps {
  selectedDate: Date | null;
  setSelectedDate: (date: Date | null) => void;
  selectedTime: string | null;
  setSelectedTime: (time: string | null) => void;
  containerClassName?: string;
  dateButtonClassName?: string;
  timeButtonClassName?: string;
  dateButtonTextClassName?: string;
  timeButtonTextClassName?: string;
}

const monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const DateTimePicker: React.FC<DateTimePickerProps> = ({
  selectedDate,
  setSelectedDate,
  selectedTime,
  setSelectedTime,
  containerClassName = '',
  dateButtonClassName = '',
  timeButtonClassName = '',
  dateButtonTextClassName = '',
  timeButtonTextClassName = '',
}) => {
  const today = new Date();
  const [currentDate, setCurrentDate] = useState(selectedDate || today);
  const [tempSelectedDate, setTempSelectedDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showMonthModal, setShowMonthModal] = useState(false);
  const [showYearModal, setShowYearModal] = useState(false);

  useEffect(() => {
    if (selectedDate) {
      setCurrentDate(selectedDate);
    }
  }, [selectedDate]);

  // Calendar logic
  const start = startOfMonth(currentDate);
  const end = endOfMonth(currentDate);
  const monthDays = eachDayOfInterval({ start, end });
  const startDay = getDay(start);
  const paddedDays = Array(startDay).fill(null).concat(monthDays);

  const handleDateSelect = (day: Date) => {
    if (!isBefore(day, today.setHours(0, 0, 0, 0))) {
      setTempSelectedDate(day);
    }
  };

  const canNavigateToPreviousMonth = (): boolean => {
    const prevMonth = new Date(currentDate);
    prevMonth.setMonth(prevMonth.getMonth() - 1);
    const endOfPrevMonth = endOfMonth(prevMonth);
    return !isBefore(endOfPrevMonth, today.setHours(0, 0, 0, 0));
  };

  const handlePreviousMonth = () => {
    if (canNavigateToPreviousMonth()) {
      const prevMonth = new Date(currentDate);
      prevMonth.setMonth(prevMonth.getMonth() - 1);
      setCurrentDate(prevMonth);
    }
  };

  const handleNextMonth = () => {
    const nextMonth = new Date(currentDate);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    setCurrentDate(nextMonth);
  };

  const handleMonthSelect = (index: number) => {
    const newDate = setMonth(currentDate, index);
    const endNew = endOfMonth(newDate);
    if (!isBefore(endNew, today.setHours(0, 0, 0, 0))) {
      setCurrentDate(newDate);
    } else {
      // If selected month is invalid, set to current month
      setCurrentDate(today);
    }
    setShowMonthModal(false);
  };

  const handleYearSelect = (year: number) => {
    const newDate = setYear(currentDate, year);
    const endNew = endOfMonth(newDate);
    if (!isBefore(endNew, today.setHours(0, 0, 0, 0))) {
      setCurrentDate(newDate);
    } else {
      // If selected year makes the date invalid, set to current date
      setCurrentDate(today);
    }
    setShowYearModal(false);
  };

  const handleToday = () => {
    setTempSelectedDate(today);
    setCurrentDate(today);
  };

  const handleDateCancel = () => {
    setTempSelectedDate(null);
    setShowDatePicker(false);
  };

  const handleDateConfirm = () => {
    if (tempSelectedDate) {
      setSelectedDate(tempSelectedDate);
      
      // Validate previously selected time if today is selected
      if (selectedTime && isToday(tempSelectedDate)) {
        const now = new Date();
        const [h, m] = selectedTime.split(':').map(Number);
        const timeDate = new Date(tempSelectedDate);
        timeDate.setHours(h, m, 0, 0);
        if (timeDate <= now) {
          const validTime = roundUpToNext10(now);
          setSelectedTime(validTime);
        }
      }
    }
    setTempSelectedDate(null);
    setShowDatePicker(false);
  };

  // Time picker logic
  const isToday = (date: Date): boolean => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  const roundUpToNext10 = (now: Date): string => {
    const minute = now.getMinutes();
    const second = now.getSeconds();
    let nextMinute = Math.ceil((minute + (second > 0 ? 1 : 0)) / 10) * 10;
    let hour = now.getHours();

    if (nextMinute >= 60) {
      nextMinute = 0;
      hour++;
    }

    if (hour >= 24) {
      hour = 0;
    }

    return `${hour.toString().padStart(2, '0')}:${nextMinute
      .toString()
      .padStart(2, '0')}`;
  };

  const getNext10MinSlots = (): string[] => {
    const slots: string[] = [];
    let startHour = 0;
    let startMinute = 0;

    if (selectedDate && isToday(selectedDate)) {
      const currentMinutes = today.getMinutes();
      const nextSlotMinute =
        Math.ceil((currentMinutes + (today.getSeconds() > 0 ? 1 : 0)) / 10) * 10;
      startHour = today.getHours();
      startMinute = nextSlotMinute >= 60 ? 0 : nextSlotMinute;
      if (nextSlotMinute >= 60) startHour++;
    }

    for (let h = startHour; h < 24; h++) {
      for (let m = h === startHour ? startMinute : 0; m < 60; m += 10) {
        const hrStr = h.toString().padStart(2, '0');
        const minStr = m.toString().padStart(2, '0');
        slots.push(`${hrStr}:${minStr}`);
      }
    }
    return slots;
  };

  const timeSlots = getNext10MinSlots();

  const handleTimeSelect = (time: string) => {
    setSelectedTime(time);
    setShowTimePicker(false);
  };

  return (
    <View className={`flex-row gap-4 ${containerClassName}`}>
      {/* Date Picker Button */}
      <TouchableOpacity
        onPress={() => {
          setShowDatePicker(!showDatePicker);
          setShowTimePicker(false);
        }}
        className={`flex-1 border border-gray-300 p-3 rounded-lg items-center ${dateButtonClassName}`}>
        <Text className={`text-gray-700 ${dateButtonTextClassName}`}>
          {selectedDate ? format(selectedDate, 'yyyy-MM-dd') : 'Select Date'}
        </Text>
      </TouchableOpacity>

      {/* Time Picker Button */}
      <TouchableOpacity
        onPress={() => {
          setShowTimePicker(!showTimePicker);
          setShowDatePicker(false);
        }}
        className={`flex-1 border border-gray-300 p-3 rounded-lg items-center ${timeButtonClassName}`}>
        <Text className={`text-gray-700 ${timeButtonTextClassName}`}>
          {selectedTime || 'Select Time'}
        </Text>
      </TouchableOpacity>

      {/* Date Picker Modal */}
      {showDatePicker && (
        <Modal
          visible={showDatePicker}
          transparent
          animationType="slide"
          onRequestClose={() => setShowDatePicker(false)}>
          <TouchableWithoutFeedback onPress={() => setShowDatePicker(false)}>
            <View className="flex-1 justify-center items-center bg-black/20">
              <TouchableWithoutFeedback>
                <View className="bg-white p-4 rounded-xl shadow-lg mx-4 w-80">
                  {/* Header with Navigation */}
                  <View className="flex-row justify-between items-center mb-3">
                    {/* Previous Month Arrow */}
                    <TouchableOpacity 
                      onPress={handlePreviousMonth}
                      disabled={!canNavigateToPreviousMonth()}
                      className={`p-2 ${!canNavigateToPreviousMonth() ? 'opacity-30' : ''}`}>
                      <Text className="text-blue-500 text-lg font-bold">‹</Text>
                    </TouchableOpacity>

                    {/* Month and Year */}
                    <View className="flex-row gap-4">
                      <TouchableOpacity onPress={() => setShowMonthModal(true)}>
                        <Text className="text-blue-500 text-base p-2">
                          {monthNames[currentDate.getMonth()]}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => setShowYearModal(true)}>
                        <Text className="text-blue-500 text-base p-2">
                          {currentDate.getFullYear()}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {/* Next Month Arrow */}
                    <TouchableOpacity onPress={handleNextMonth} className="p-2">
                      <Text className="text-blue-500 text-lg font-bold">›</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Week Days */}
                  <View className="flex-row justify-between mb-2">
                    {dayNames.map((day) => (
                      <Text key={day} className="w-10 text-center font-bold text-gray-600">
                        {day}
                      </Text>
                    ))}
                  </View>

                  {/* Calendar Grid */}
                  <FlatList
                    data={paddedDays}
                    numColumns={7}
                    keyExtractor={(item, index) =>
                      item ? item.toISOString() : `empty-${index}`
                    }
                    renderItem={({ item }) => {
                      if (!item) return <View className="w-10 h-10 m-1" />;
                      const disabled = isBefore(item, today.setHours(0, 0, 0, 0));
                      const isSelected = tempSelectedDate && isSameDay(item, tempSelectedDate);
                      const isCurrentlySelected = selectedDate && isSameDay(item, selectedDate);
                      return (
                        <TouchableOpacity
                          disabled={disabled}
                          onPress={() => handleDateSelect(item)}
                          className={`w-10 h-10 m-1 justify-center items-center rounded-full ${
                            isSelected
                              ? 'bg-blue-500'
                              : isCurrentlySelected
                              ? 'bg-blue-200'
                              : 'bg-white'
                          }`}>
                          <Text
                            className={`text-sm ${
                              disabled
                                ? 'text-gray-400'
                                : isSelected
                                ? 'text-white font-bold'
                                : isCurrentlySelected
                                ? 'text-blue-700 font-medium'
                                : 'text-black'
                            }`}>
                            {item.getDate()}
                          </Text>
                        </TouchableOpacity>
                      );
                    }}
                  />

                  {/* Bottom Actions */}
                  <View className="mt-3 flex-row justify-between items-center">
                    <TouchableOpacity onPress={handleToday}>
                      <Text className="text-blue-500 text-sm">Today</Text>
                    </TouchableOpacity>
                    <View className="flex-row gap-5">
                      <TouchableOpacity onPress={handleDateCancel}>
                        <Text className="text-blue-500 text-sm">Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={handleDateConfirm}>
                        <Text className={`text-blue-500 text-sm font-bold ${
                          !tempSelectedDate ? 'opacity-50' : ''
                        }`}>OK</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </Modal>
      )}

      {/* Time Picker Modal */}
      {showTimePicker && (
        <Modal
          visible={showTimePicker}
          transparent
          animationType="fade"
          onRequestClose={() => setShowTimePicker(false)}>
          <TouchableWithoutFeedback onPress={() => setShowTimePicker(false)}>
            <View className="flex-1 justify-center items-center bg-black/20">
              <TouchableWithoutFeedback>
                <View className="w-32 max-h-80 bg-white rounded-lg shadow-lg">
                  <FlatList
                    data={timeSlots}
                    keyExtractor={(item) => item}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        onPress={() => handleTimeSelect(item)}
                        className="py-3 px-5">
                        <Text
                          className={`text-base text-center ${
                            item === selectedTime
                              ? 'text-blue-500 font-bold'
                              : 'text-gray-700'
                          }`}>
                          {item}
                        </Text>
                      </TouchableOpacity>
                    )}
                    contentContainerStyle={{ paddingVertical: 10 }}
                  />
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </Modal>
      )}

      {/* Month Modal */}
      <Modal visible={showMonthModal} transparent animationType="slide">
        <TouchableWithoutFeedback onPress={() => setShowMonthModal(false)}>
          <View className="flex-1 justify-center items-center bg-black/20">
            <TouchableWithoutFeedback>
              <View className="w-64 bg-white rounded-lg p-4 max-h-80">
                <ScrollView>
                  {monthNames.map((name, index) => {
                    const testDate = setMonth(currentDate, index);
                    const endOfTestMonth = endOfMonth(testDate);
                    const isDisabled = isBefore(endOfTestMonth, today.setHours(0, 0, 0, 0));
                    
                    return (
                      <TouchableOpacity
                        key={name}
                        onPress={() => !isDisabled && handleMonthSelect(index)}
                        disabled={isDisabled}
                        className={`py-2.5 border-b border-gray-200 ${
                          isDisabled ? 'opacity-40' : ''
                        }`}>
                        <Text className={`text-base text-center ${
                          isDisabled ? 'text-gray-400' : 'text-black'
                        }`}>{name}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Year Modal */}
      <Modal visible={showYearModal} transparent animationType="slide">
        <TouchableWithoutFeedback onPress={() => setShowYearModal(false)}>
          <View className="flex-1 justify-center items-center bg-black/20">
            <TouchableWithoutFeedback>
              <View className="w-64 bg-white rounded-lg p-4 max-h-80">
                <ScrollView>
                  {Array.from(
                    { length: 11 },
                    (_, i) => today.getFullYear() + i
                  ).map((year) => {
                    const testDate = setYear(currentDate, year);
                    const endOfTestYear = endOfMonth(testDate);
                    const isDisabled = isBefore(endOfTestYear, today.setHours(0, 0, 0, 0));
                    
                    return (
                      <TouchableOpacity
                        key={year}
                        onPress={() => !isDisabled && handleYearSelect(year)}
                        disabled={isDisabled}
                        className={`py-2.5 border-b border-gray-200 ${
                          isDisabled ? 'opacity-40' : ''
                        }`}>
                        <Text className={`text-base text-center ${
                          isDisabled ? 'text-gray-400' : 'text-black'
                        }`}>{year}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
};

export default DateTimePicker;