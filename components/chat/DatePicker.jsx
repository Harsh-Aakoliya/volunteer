import React, { useState, useRef, useEffect } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  Modal,
  ScrollView,
  Dimensions
} from 'react-native';

const DateTimePicker = () => {
  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType] = useState(null); // 'date', 'time', or 'datetime'
  const [currentStep, setCurrentStep] = useState('date'); // For datetime picker: 'date' then 'time'
  
  // Store selected values
  const [selectedDate, setSelectedDate] = useState({
    month: 'May',
      day: 20,
      year: 2025
    });
  
  const [selectedTime, setSelectedTime] = useState({
    hour: 17,
    minute: 9
  });
  useEffect(() => {
    const currentDate = new Date();
    setSelectedDate({
      month: months[currentDate.getMonth()],
      day: currentDate.getDate(),
      year: currentDate.getFullYear()
    });
    setSelectedTime({
      hour: currentDate.getHours(),
      minute: currentDate.getMinutes()
    });
  },[]);


  console.log("selectedDate",selectedDate);
  console.log("selectedTime",selectedTime);

  // References for ScrollViews
  const monthScrollRef = useRef(null);
  const dayScrollRef = useRef(null);
  const yearScrollRef = useRef(null);
  const hourScrollRef = useRef(null);
  const minuteScrollRef = useRef(null);

  // Set up data arrays
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const years = Array.from({ length: 10 }, (_, i) => 2020 + i);
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const minutes = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'));

  // Calculate days in month based on selected month and year
  const getDaysInMonth = (month, year) => {
    const monthIndex = months.indexOf(month);
    if (monthIndex === 1) { // February
      // Check for leap year
      return ((year % 4 === 0) && (year % 100 !== 0)) || (year % 400 === 0) ? 29 : 28;
    }
    return [0, 2, 4, 6, 7, 9, 11].includes(monthIndex) ? 31 : 30;
  };

  // Dynamic days array based on selected month and year
  const [days, setDays] = useState([]);

  useEffect(() => {
    const daysInMonth = getDaysInMonth(selectedDate.month, selectedDate.year);
    setDays(Array.from({ length: daysInMonth }, (_, i) => i + 1));
    
    // Adjust day if current selection is invalid for new month
    if (selectedDate.day > daysInMonth) {
      setSelectedDate(prev => ({ ...prev, day: daysInMonth }));
    }
  }, [selectedDate.month, selectedDate.year]);

  // Item height for scrolling calculations
  const ITEM_HEIGHT = 40;
  const VISIBLE_ITEMS = 3;
  const { width } = Dimensions.get('window');

  const openPicker = (type) => {
    setModalType(type);
    setModalVisible(true);
    if (type === 'datetime') {
      setCurrentStep('date');
    }
  };

  // Scroll to selected values when modal opens
  useEffect(() => {
    if (modalVisible) {
      setTimeout(() => {
        // Scroll to the current selections
        const scrollToPosition = (ref, index) => {
          if (ref.current) {
            ref.current.scrollTo({ y: index * ITEM_HEIGHT, animated: true });
          }
        };
        
        if (modalType === 'date' || (modalType === 'datetime' && currentStep === 'date')) {
          scrollToPosition(monthScrollRef, months.indexOf(selectedDate.month));
          scrollToPosition(dayScrollRef, selectedDate.day - 1);
          scrollToPosition(yearScrollRef, years.indexOf(selectedDate.year));
        }
        
        if (modalType === 'time' || (modalType === 'datetime' && currentStep === 'time')) {
          scrollToPosition(hourScrollRef, selectedTime.hour);
          scrollToPosition(minuteScrollRef, parseInt(selectedTime.minute));
        }
      }, 200);
    }
  }, [modalVisible, currentStep]);

  const handleConfirm = () => {
    if (modalType === 'datetime' && currentStep === 'date') {
      // Move to time selection
      setCurrentStep('time');
    } else {
      // Close modal for all other cases
      setModalVisible(false);
    }
  };

  const handleScroll = (event, type, valueArray) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    const index = Math.round(offsetY / ITEM_HEIGHT);
    
    if (index >= 0 && index < valueArray.length) {
      // Update selected value based on scroll position
      const value = valueArray[index];
      
      if (type === 'month') {
        setSelectedDate(prev => ({ ...prev, month: value }));
      } else if (type === 'day') {
        setSelectedDate(prev => ({ ...prev, day: value }));
      } else if (type === 'year') {
        setSelectedDate(prev => ({ ...prev, year: value }));
      } else if (type === 'hour') {
        setSelectedTime(prev => ({ ...prev, hour: value }));
      } else if (type === 'minute') {
        setSelectedTime(prev => ({ ...prev, minute: parseInt(value) }));
      }
    }
  };

  const formatSelectedDateTime = () => {
    const { month, day, year } = selectedDate;
    const { hour, minute } = selectedTime;
    const formattedHour = hour.toString().padStart(2, '0');
    const formattedMinute = minute.toString().padStart(2, '0');
    return `${month} ${day}, ${year} at ${formattedHour}:${formattedMinute}`;
  };

  // Wheel picker item component
  const PickerItem = ({ value, isSelected }) => (
    <View style={{ height: ITEM_HEIGHT, justifyContent: 'center', alignItems: 'center' }}>
      <Text className={`text-center ${isSelected ? 'text-black font-bold' : 'text-gray-400'}`}>
        {value}
      </Text>
    </View>
  );

  // Wheel picker component
  const WheelPicker = ({ items, selectedItem, scrollRef, onScroll, itemWidth }) => (
    <View className="overflow-hidden" style={{ height: ITEM_HEIGHT * VISIBLE_ITEMS }}>
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        onMomentumScrollEnd={(e) => onScroll(e, items)}
        contentContainerStyle={{ paddingVertical: ITEM_HEIGHT }}
        style={{ width: itemWidth }}
      >
        {items.map((item, index) => (
          <PickerItem key={index} value={item} isSelected={item === selectedItem} />
        ))}
      </ScrollView>
      
      {/* Selector overlay */}
      <View className="absolute top-0 left-0 right-0" style={{ height: '100%' }}>
        <View style={{ height: ITEM_HEIGHT }} />
        <View className="border-t border-b border-gray-200" style={{ height: ITEM_HEIGHT }} />
        <View style={{ height: ITEM_HEIGHT }} />
      </View>
    </View>
  );

  const renderDatePicker = () => (
    <View className="bg-white rounded-lg p-4 w-full">
      <Text className="text-lg font-medium text-center mb-4">Select date</Text>
      
      <View className="flex-row justify-center">
        {/* Month Picker */}
        <WheelPicker
          items={months}
          selectedItem={selectedDate.month}
          scrollRef={monthScrollRef}
          onScroll={(e, items) => handleScroll(e, 'month', items)}
          itemWidth={width * 0.25}
        />
        
        {/* Day Picker */}
        <WheelPicker
          items={days}
          selectedItem={selectedDate.day}
          scrollRef={dayScrollRef}
          onScroll={(e, items) => handleScroll(e, 'day', items)}
          itemWidth={width * 0.15}
        />
        
        {/* Year Picker */}
        <WheelPicker
          items={years}
          selectedItem={selectedDate.year}
          scrollRef={yearScrollRef}
          onScroll={(e, items) => handleScroll(e, 'year', items)}
          itemWidth={width * 0.2}
        />
      </View>
      
      <View className="flex-row justify-end mt-6">
        <TouchableOpacity 
          onPress={() => setModalVisible(false)}
          className="px-4 py-2"
        >
          <Text className="text-blue-500">CANCEL</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          onPress={handleConfirm}
          className="px-4 py-2"
        >
          <Text className="text-green-500">CONFIRM</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderTimePicker = () => (
    <View className="bg-white rounded-lg p-4 w-full">
      <Text className="text-lg font-medium text-center mb-4">Select time</Text>
      
      <View className="flex-row justify-center">
        {/* Hour Picker */}
        <WheelPicker
          items={hours}
          selectedItem={selectedTime.hour}
          scrollRef={hourScrollRef}
          onScroll={(e, items) => handleScroll(e, 'hour', items)}
          itemWidth={width * 0.2}
        />
        
        {/* Minute Picker */}
        <WheelPicker
          items={minutes}
          selectedItem={selectedTime.minute.toString().padStart(2, '0')}
          scrollRef={minuteScrollRef}
          onScroll={(e, items) => handleScroll(e, 'minute', items)}
          itemWidth={width * 0.2}
        />
      </View>
      
      <View className="flex-row justify-end mt-6">
        <TouchableOpacity 
          onPress={() => setModalVisible(false)}
          className="px-4 py-2"
        >
          <Text className="text-blue-500">CANCEL</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          onPress={handleConfirm}
          className="px-4 py-2"
        >
          <Text className="text-green-500">CONFIRM</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View className="flex-1 items-center justify-center bg-gray-100 p-4">
      <TouchableOpacity
        onPress={() => openPicker('datetime')}
        className="bg-blue-500 w-full py-3 rounded mb-4"
      >
        <Text className="text-white text-center uppercase font-medium">Pick Datetime</Text>
      </TouchableOpacity>
      
      <TouchableOpacity
        onPress={() => openPicker('date')}
        className="bg-blue-500 w-full py-3 rounded mb-4"
      >
        <Text className="text-white text-center uppercase font-medium">Pick Date</Text>
      </TouchableOpacity>
      
      <TouchableOpacity
        onPress={() => openPicker('time')}
        className="bg-blue-500 w-full py-3 rounded mb-4"
      >
        <Text className="text-white text-center uppercase font-medium">Pick Time</Text>
      </TouchableOpacity>
      
      {/* Display selected date/time */}
      {(selectedDate || selectedTime) && (
        <View className="mt-4">
          <Text className="text-center">
            Selected: {formatSelectedDateTime()}
          </Text>
        </View>
      )}

      <Modal
        animationType="fade"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View className="flex-1 justify-center items-center bg-black bg-opacity-50 p-4">
          <View className="bg-white rounded-lg w-4/5">
            {modalType === 'date' && renderDatePicker()}
            {modalType === 'time' && renderTimePicker()}
            {modalType === 'datetime' && currentStep === 'date' && renderDatePicker()}
            {modalType === 'datetime' && currentStep === 'time' && renderTimePicker()}
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default DateTimePicker;