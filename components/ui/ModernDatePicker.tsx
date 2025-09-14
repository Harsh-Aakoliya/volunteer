// components/ui/ModernDatePicker.tsx
////////import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
interface ModernDatePickerProps {
  selectedDate: Date | null;
  onDateChange: (date: Date | null) => void;
  placeholder?: string;
  label?: string;
  className?: string;
  disabled?: boolean;
}

const ModernDatePicker: React.FC<ModernDatePickerProps> = ({
  selectedDate,
  onDateChange,
  placeholder = "No DOB selected",
  label,
  className = "",
  disabled = false
}) => {
  const [isPickerVisible, setIsPickerVisible] = useState(false);
  const [tempDay, setTempDay] = useState(selectedDate?.getDate() || 1);
  const [tempMonth, setTempMonth] = useState(selectedDate?.getMonth() || 0);
  const [tempYear, setTempYear] = useState(selectedDate?.getFullYear() || 2000);

  const formatDate = (date: Date | null): string => {
    if (!date) return placeholder;
    
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    
    return `${day}/${month}/${year}`;
  };

  const generateYears = () => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let year = 1950; year <= currentYear; year++) {
      years.push(year);
    }
    return years.reverse();
  };

  const generateDays = () => {
    const daysInMonth = new Date(tempYear, tempMonth + 1, 0).getDate();
    const days = [];
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(day);
    }
    return days;
  };

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const handleConfirm = () => {
    const newDate = new Date(tempYear, tempMonth, tempDay);
    onDateChange(newDate);
    setIsPickerVisible(false);
  };

  const handleCancel = () => {
    if (selectedDate) {
      setTempDay(selectedDate.getDate());
      setTempMonth(selectedDate.getMonth());
      setTempYear(selectedDate.getFullYear());
    }
    setIsPickerVisible(false);
  };

  const handleClear = () => {
    onDateChange(null);
    setIsPickerVisible(false);
  };

  const showPicker = () => {
    if (!disabled) {
      if (selectedDate) {
        setTempDay(selectedDate.getDate());
        setTempMonth(selectedDate.getMonth());
        setTempYear(selectedDate.getFullYear());
      }
      setIsPickerVisible(true);
    }
  };

  return (
    <View className={className}>
      {label && (
        <Text className="text-sm font-medium text-gray-700 mb-2">{label}</Text>
      )}
      
      <View className="flex-row items-center">
        <TouchableOpacity
          className="flex-1 bg-white border border-gray-300 rounded-lg p-4 flex-row items-center justify-between"
          onPress={showPicker}
          disabled={disabled}
        >
          <Text className={`text-base ${selectedDate ? 'text-gray-800' : 'text-gray-500'}`}>
            {formatDate(selectedDate)}
          </Text>
          <Ionicons name="calendar-outline" size={20} color="#6B7280" />
        </TouchableOpacity>
      </View>

      <Modal
        visible={isPickerVisible}
        transparent
        animationType="fade"
        onRequestClose={handleCancel}
      >
        <View className="flex-1 justify-center items-center bg-black/50 px-6">
          <View className="bg-white rounded-3xl p-6 w-full max-w-sm">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-xl font-bold text-gray-800">Select Date of Birth</Text>
              <TouchableOpacity onPress={handleCancel}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
            
            {/* Date Picker Wheels */}
            <View className="flex-row justify-between mb-6">
              {/* Day Picker */}
              <View className="flex-1 mx-1">
                <Text className="text-center font-medium mb-2">Day</Text>
                <ScrollView 
                  className="max-h-32 bg-gray-50 rounded-lg"
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{ paddingVertical: 8 }}
                >
                  {generateDays().map(day => (
                    <TouchableOpacity
                      key={day}
                      onPress={() => setTempDay(day)}
                      className={`py-3 ${tempDay === day ? 'bg-blue-100' : ''}`}
                    >
                      <Text className={`text-center ${tempDay === day ? 'text-blue-600 font-bold' : 'text-gray-700'}`}>
                        {day}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Month Picker */}
              <View className="flex-1 mx-1">
                <Text className="text-center font-medium mb-2">Month</Text>
                <ScrollView 
                  className="max-h-32 bg-gray-50 rounded-lg"
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{ paddingVertical: 8 }}
                >
                  {months.map((month, index) => (
                    <TouchableOpacity
                      key={index}
                      onPress={() => setTempMonth(index)}
                      className={`py-3 ${tempMonth === index ? 'bg-blue-100' : ''}`}
                    >
                      <Text className={`text-center text-xs ${tempMonth === index ? 'text-blue-600 font-bold' : 'text-gray-700'}`}>
                        {month}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Year Picker */}
              <View className="flex-1 mx-1">
                <Text className="text-center font-medium mb-2">Year</Text>
                <ScrollView 
                  className="max-h-32 bg-gray-50 rounded-lg"
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{ paddingVertical: 8 }}
                >
                  {generateYears().map(year => (
                    <TouchableOpacity
                      key={year}
                      onPress={() => setTempYear(year)}
                      className={`py-3 ${tempYear === year ? 'bg-blue-100' : ''}`}
                    >
                      <Text className={`text-center ${tempYear === year ? 'text-blue-600 font-bold' : 'text-gray-700'}`}>
                        {year}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>
            
            <View className="flex-row space-x-3 mt-6">
              <TouchableOpacity
                className="flex-1 bg-red-100 py-3 rounded-lg"
                onPress={handleClear}
              >
                <Text className="text-red-700 text-center font-medium">Clear</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                className="flex-1 bg-gray-100 py-3 rounded-lg"
                onPress={handleCancel}
              >
                <Text className="text-gray-700 text-center font-medium">Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                className="flex-1 bg-blue-500 py-3 rounded-lg"
                onPress={handleConfirm}
              >
                <Text className="text-white text-center font-medium">Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default ModernDatePicker;
