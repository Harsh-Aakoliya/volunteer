// app/chat/table.tsx
import { View, Text, TouchableOpacity, TextInput, ScrollView, Modal, Dimensions, Alert, ActivityIndicator } from 'react-native'
import React, { useState, useEffect } from 'react'
import { useLocalSearchParams } from 'expo-router';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
import { API_URL } from '@/constants/api';
import { AuthStorage } from '@/utils/authStorage';
import axios from 'axios';
import { router } from 'expo-router';
const Table: React.FC = () => {
  const { roomId, userId } = useLocalSearchParams<{ roomId: string; userId: string }>();
  const [tableTitle, setTableTitle] = useState("this is table title");
  const [tableData, setTableData] = useState<string[][]>([
    ['1', '', '', ''],
    ['2', '', '', '']
  ]);
  const [sending, setSending] = useState(false);
  console.log(tableData);

  const sendTableToChat = async () => {
    console.log("Sending table to chat");
    setSending(true);
    try {
      // First create the table with headers included
      const response = await axios.post(`${API_URL}/api/table/`, {
        roomId: roomId,
        senderId: userId,
        tableTitle: tableTitle,
        tableData: tableData,
        tableHeaders: headers  // Include headers in the request
      });
      
      console.log("Table created with ID:", response.data.result.id);
      const tableId = response.data.result.id;
      
      // Then send it as a message
      const messageText = "";
      const token = await AuthStorage.getToken();
      
      const messageResponse = await axios.post(
        `${API_URL}/api/chat/rooms/${roomId}/messages`,
        {
          messageText,
          messageType: "table",
          tableId: tableId,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      
      console.log("Table sent to chat successfully:", messageResponse.data);
      Alert.alert("Success", "Table sent to chat successfully!", [
        { text: "OK", onPress: () => router.back() }
      ]);
      
    } catch (error) {
      console.error("Error sending table to chat:", error);
      Alert.alert("Error", "Failed to send table to chat. Please try again.");
    } finally {
      setSending(false);
    }
  };

  const [headers, setHeaders] = useState<string[]>(['Sr No', 'Column1', 'Column2', 'Column3']);
  const [contextMenu, setContextMenu] = useState<{ 
    visible: boolean; 
    type: string; 
    index: number; 
    x: number; 
    y: number; 
  }>({ visible: false, type: '', index: -1, x: 0, y: 0 });

  const addColumn = () => {
    const newColumnIndex = headers.length;
    const newHeaders = [...headers, `Column${newColumnIndex}`];
    const newTableData = tableData.map(row => [...row, '']);
    
    setHeaders(newHeaders);
    setTableData(newTableData);
  };

  const addRow = () => {
    const newRowNumber = tableData.length + 1;
    const newRow = [String(newRowNumber), ...new Array(headers.length - 1).fill('')];
    setTableData([...tableData, newRow]);
  };

  const updateCell = (rowIndex: number, colIndex: number, value: string) => {
    const newData = [...tableData];
    newData[rowIndex] = [...newData[rowIndex]];
    newData[rowIndex][colIndex] = value;
    setTableData(newData);
  };

  const updateHeader = (index: number, value: string) => {
    if (index === 0) return; // Can't edit Sr No header
    const newHeaders = [...headers];
    newHeaders[index] = value;
    setHeaders(newHeaders);
  };

  const showContextMenu = (type: string, index: number, event: any) => {
    const { pageX, pageY } = event.nativeEvent;
    setContextMenu({
      visible: true,
      type,
      index,
      x: pageX,
      y: pageY
    });
  };

  const hideContextMenu = () => {
    setContextMenu({ visible: false, type: '', index: -1, x: 0, y: 0 });
  };

  const deleteColumn = (index: number) => {
    if (index === 0 || headers.length <= 2) return; // Can't delete Sr No or if only 2 columns left
    
    const newHeaders = headers.filter((_, i) => i !== index);
    const newTableData = tableData.map(row => row.filter((_, i) => i !== index));
    
    setHeaders(newHeaders);
    setTableData(newTableData);
    hideContextMenu();
  };

  const deleteRow = (index: number) => {
    if (tableData.length <= 1) return; // Keep at least one row
    
    const newTableData = tableData.filter((_, i) => i !== index);
    
    // Update Sr No for remaining rows
    const updatedData = newTableData.map((row, i) => {
      const newRow = [...row];
      newRow[0] = String(i + 1);
      return newRow;
    });
    
    setTableData(updatedData);
    hideContextMenu();
  };

  const copyColumn = (index: number, direction: 'left' | 'right') => {
    if (index === 0) return; // Can't copy Sr No column
    
    const columnData = tableData.map(row => row[index]);
    const insertIndex = direction === 'right' ? index + 1 : index;
    
    const newHeaders = [...headers];
    newHeaders.splice(insertIndex, 0, `${headers[index]} Copy`);
    
    const newTableData = tableData.map((row, rowIndex) => {
      const newRow = [...row];
      newRow.splice(insertIndex, 0, columnData[rowIndex]);
      return newRow;
    });
    
    setHeaders(newHeaders);
    setTableData(newTableData);
    hideContextMenu();
  };

  const copyRow = (index: number, direction: 'up' | 'down') => {
    const rowData = [...tableData[index]];
    const insertIndex = direction === 'down' ? index + 1 : index;
    
    const newTableData = [...tableData];
    newTableData.splice(insertIndex, 0, rowData);
    
    // Update Sr No for all rows
    const updatedData = newTableData.map((row, i) => {
      const newRow = [...row];
      newRow[0] = String(i + 1);
      return newRow;
    });
    
    setTableData(updatedData);
    hideContextMenu();
  };

  const renderContextMenu = () => {
    if (!contextMenu.visible) return null;

    const menuItems = contextMenu.type === 'column' ? [
      { title: 'Delete Column', action: () => deleteColumn(contextMenu.index), disabled: contextMenu.index === 0 || headers.length <= 2 },
      { title: 'Copy Left', action: () => copyColumn(contextMenu.index, 'left'), disabled: contextMenu.index === 0 },
      { title: 'Copy Right', action: () => copyColumn(contextMenu.index, 'right'), disabled: contextMenu.index === 0 },
    ] : [
      { title: 'Delete Row', action: () => deleteRow(contextMenu.index), disabled: tableData.length <= 1 },
      { title: 'Copy Up', action: () => copyRow(contextMenu.index, 'up') },
      { title: 'Copy Down', action: () => copyRow(contextMenu.index, 'down') },
    ];

    return (
      <Modal transparent visible={true} onRequestClose={hideContextMenu}>
        <TouchableOpacity 
          className="flex-1" 
          activeOpacity={1} 
          onPress={hideContextMenu}
        >
          <View
            className="absolute bg-white rounded-lg py-2 min-w-[150px] shadow-2xl border border-gray-200"
            style={{
              left: Math.min(contextMenu.x, screenWidth - 150),
              top: Math.min(contextMenu.y, screenHeight - 200),
            }}
          >
            {menuItems.map((item, index) => (
              <TouchableOpacity
                key={index}
                onPress={item.disabled ? undefined : item.action}
                className={`px-4 py-3 ${item.disabled ? 'opacity-50' : 'opacity-100'}`}
                disabled={item.disabled}
              >
                <Text className={`${item.disabled ? 'text-gray-400' : 'text-gray-800'} text-sm font-medium`}>
                  {item.title}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    );
  };

  return (
    <View className="flex-1 bg-gray-50">
      {/* Compact Header */}
      <View className="px-4 py-3 bg-white shadow-sm border-b border-gray-200">
        <View className="flex-row justify-between items-center mb-3">
          <Text className="text-2xl font-bold text-gray-900">
            Excel Table
          </Text>
          <Text className="text-xs text-gray-500">
            Room: {roomId} | User: {userId}
          </Text>
        </View>
        
        {/* Simple Title Input */}
        <TextInput
          value={tableTitle}
          onChangeText={setTableTitle}
          className="border border-gray-300 rounded-lg px-3 py-2 text-gray-800 font-medium"
          placeholder="Enter title"
          placeholderTextColor="#9CA3AF"
        />
      </View>

      {/* Add Buttons */}
      <View className="flex-row justify-between px-4 py-3 bg-white border-b border-gray-200">
        <TouchableOpacity
          onPress={addColumn}
          className="bg-blue-50 border border-blue-200 px-4 py-2 rounded-lg flex-row items-center"
        >
          <Text className="text-blue-600 text-sm font-semibold">+ Add Column</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          onPress={addRow}
          className="bg-green-50 border border-green-200 px-4 py-2 rounded-lg flex-row items-center"
        >
          <Text className="text-green-600 text-sm font-semibold">+ Add Row</Text>
        </TouchableOpacity>

        {/* Send Table Button */}
        <TouchableOpacity
          onPress={sendTableToChat}
          disabled={sending}
          className={`flex-row items-center justify-center px-4 py-2 rounded-lg ${
            sending ? 'bg-gray-400 border border-gray-300' : 'bg-blue-600 border border-blue-700'
          }`}
        >
          {sending ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <>
              <Text className="text-white text-sm mr-1">📊</Text>
              <Text className="text-white text-sm font-semibold">SEND</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Table Container - More Space */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={true}
        className="flex-1 bg-white"
      >
        <ScrollView showsVerticalScrollIndicator={true}>
          <View className="border border-gray-300">
            {/* Header Row */}
            <View className="flex-row bg-gray-100 border-b-2 border-gray-300">
              {headers.map((header, colIndex) => (
                <TouchableOpacity
                  key={colIndex}
                  onLongPress={(e) => showContextMenu('column', colIndex, e)}
                  className={`w-32 min-h-[48px] px-3 py-2 justify-center border-r border-gray-300 ${colIndex === 0 ? 'bg-gray-200' : 'bg-gray-100'}`}
                >
                  {colIndex === 0 ? (
                    <Text className="text-gray-700 font-bold text-sm text-center">
                      {header}
                    </Text>
                  ) : (
                    <TextInput
                      value={header}
                      onChangeText={(text) => updateHeader(colIndex, text)}
                      className="text-gray-700 font-semibold text-sm text-center p-0"
                      selectTextOnFocus
                      multiline
                      style={{ minHeight: 32 }}
                    />
                  )}
                </TouchableOpacity>
              ))}
            </View>

            {/* Table Rows */}
            {tableData.map((row, rowIndex) => (
              <View key={`row-${rowIndex}`} className="flex-row border-b border-gray-200 w-fit">
                {row.map((cell, colIndex) => (
                  <TouchableOpacity
                    key={`cell-${rowIndex}-${colIndex}`}
                    onLongPress={colIndex === 0 ? (e) => showContextMenu('row', rowIndex, e) : undefined}
                    className={`w-32 min-h-[48px] px-3 py-2 justify-center border-r border-gray-200 ${colIndex === 0 ? 'bg-gray-50' : 'bg-white'} ${rowIndex % 2 === 0 ? '' : 'bg-gray-25'}`}
                  >
                    {colIndex === 0 ? (
                      <Text className="text-gray-600 font-semibold text-sm text-center">
                        {cell}
                      </Text>
                    ) : (
                      <TextInput
                        value={cell}
                        onChangeText={(text) => updateCell(rowIndex, colIndex, text)}
                        className="text-gray-800 text-sm text-center p-0 flex-1"
                        multiline={true}
                        textAlignVertical="center"
                        placeholder="Enter data"
                        placeholderTextColor="#9CA3AF"
                        style={{ minHeight: 32 }}
                      />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            ))}
          </View>
        </ScrollView>
      </ScrollView>

      {renderContextMenu()}
    </View>
  );
};

export default Table;