// components/DobPicker.tsx
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
  isAfter,
  isSameDay,
  getDay,
  setMonth,
  setYear,
} from 'date-fns';

interface DobPickerProps {
  selectedDate: Date | null;
  setSelectedDate: (date: Date | null) => void;
  containerClassName?: string;
  dateButtonClassName?: string;
  dateButtonTextClassName?: string;
}

const monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const DobPicker: React.FC<DobPickerProps> = ({
  selectedDate,
  setSelectedDate,
  containerClassName = '',
  dateButtonClassName = '',
  dateButtonTextClassName = '',
}) => {
  const today = new Date();
  const [currentDate, setCurrentDate] = useState(selectedDate || today);
  const [tempSelectedDate, setTempSelectedDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
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
    // Only allow dates that are today or in the past
    if (!isAfter(day, today)) {
      setTempSelectedDate(day);
    }
  };

  const canNavigateToNextMonth = (): boolean => {
    const nextMonth = new Date(currentDate);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    const startOfNextMonth = startOfMonth(nextMonth);
    return !isAfter(startOfNextMonth, today);
  };

  const handlePreviousMonth = () => {
    const prevMonth = new Date(currentDate);
    prevMonth.setMonth(prevMonth.getMonth() - 1);
    setCurrentDate(prevMonth);
  };

  const handleNextMonth = () => {
    if (canNavigateToNextMonth()) {
      const nextMonth = new Date(currentDate);
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      setCurrentDate(nextMonth);
    }
  };

  const handleMonthSelect = (index: number) => {
    const newDate = setMonth(currentDate, index);
    setCurrentDate(newDate);
    setShowMonthModal(false);
  };

  const handleYearSelect = (year: number) => {
    const newDate = setYear(currentDate, year);
    setCurrentDate(newDate);
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
    }
    setTempSelectedDate(null);
    setShowDatePicker(false);
  };

  return (
    <View className={`${containerClassName}`}>
      {/* Date Picker Button */}
      <TouchableOpacity
        onPress={() => setShowDatePicker(!showDatePicker)}
        className={`border border-gray-300 p-3 rounded-lg items-center ${dateButtonClassName}`}>
        <Text className={`text-gray-700 ${dateButtonTextClassName}`}>
          {selectedDate ? format(selectedDate, 'dd-MM-yyyy') : 'Select Date of Birth'}
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
                    <TouchableOpacity onPress={handlePreviousMonth} className="p-2">
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
                    <TouchableOpacity 
                      onPress={handleNextMonth} 
                      disabled={!canNavigateToNextMonth()}
                      className={`p-2 ${!canNavigateToNextMonth() ? 'opacity-30' : ''}`}>
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
                      const disabled = isAfter(item, today);
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

      {/* Month Modal */}
      <Modal visible={showMonthModal} transparent animationType="slide">
        <TouchableWithoutFeedback onPress={() => setShowMonthModal(false)}>
          <View className="flex-1 justify-center items-center bg-black/20">
            <TouchableWithoutFeedback>
              <View className="w-64 bg-white rounded-lg p-4 max-h-80">
                <ScrollView>
                  {monthNames.map((name, index) => (
                    <TouchableOpacity
                      key={name}
                      onPress={() => handleMonthSelect(index)}
                      className="py-2.5 border-b border-gray-200">
                      <Text className="text-base text-center text-black">{name}</Text>
                    </TouchableOpacity>
                  ))}
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
                    { length: 100 },
                    (_, i) => today.getFullYear() - i
                  ).map((year) => (
                    <TouchableOpacity
                      key={year}
                      onPress={() => handleYearSelect(year)}
                      className="py-2.5 border-b border-gray-200">
                      <Text className="text-base text-center text-black">{year}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
};

export default DobPicker; 