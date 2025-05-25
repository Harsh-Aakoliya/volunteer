import { Text, Modal, TouchableOpacity, View, ScrollView, ActivityIndicator } from "react-native"
import React, { useState, useEffect } from 'react'
import { API_URL } from "@/constants/api"
type TableData = {
    id: number;
    roomId: number;
    senderId: string;
    createdAt: string;
    tableTitle: string;
    messageId: string | null;
    tableData: string[][];
}

type ApiResponse = {
    result: TableData;
}

type Props = {
    tableId: number;
    setShowTable: React.Dispatch<React.SetStateAction<boolean>>;
    visible: boolean;
}

const RenderTable = ({ tableId, visible, setShowTable }: Props) => {
    const [tableData, setTableData] = useState<TableData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchTableData = async () => {
        if (!visible || !tableId) return;
        
        setLoading(true);
        setError(null);
        
        try {
            const response = await fetch(`${API_URL}/api/table/${tableId}`);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data: ApiResponse = await response.json();
            setTableData(data.result);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch table data');
            console.error('Error fetching table data:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTableData();
    }, [visible, tableId]);

    const generateHeaders = (data: string[][]) => {
        if (!data || data.length === 0) return [];
        
        const columnCount = Math.max(...data.map(row => row.length));
        const headers = ['Sr No'];
        
        for (let i = 1; i < columnCount; i++) {
            headers.push(`Column${i}`);
        }
        
        return headers;
    };

    const handleClose = () => {
        setShowTable(false);
        setTableData(null);
        setError(null);
    };

    return (
        <Modal
            visible={visible}
            // animationType="slide"
            presentationStyle="pageSheet"
        >
            <View className="flex-1 bg-gray-50">
                {/* Header */}
                <View className="px-6 pt-16 pb-6 bg-white shadow-sm border-b border-gray-200">
                    <View className="flex-row justify-between items-center">
                        <View className="flex-1">
                            <Text className="text-2xl font-bold text-gray-900">
                                {tableData?.tableTitle || 'Table View'}
                            </Text>
                            {tableData && (
                                <Text className="text-sm text-gray-500 mt-1">
                                    Sender: {tableData.senderId}
                                </Text>
                            )}
                        </View>
                        <TouchableOpacity 
                            onPress={handleClose}
                            className="bg-gray-100 px-4 py-2 rounded-lg"
                        >
                            <Text className="text-gray-700 font-semibold">Close</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Content */}
                <View className="flex-1">
                    {loading && (
                        <View className="flex-1 justify-center items-center">
                            <ActivityIndicator size="large" color="#3B82F6" />
                            <Text className="text-gray-600 mt-4">Loading table data...</Text>
                        </View>
                    )}

                    {error && (
                        <View className="flex-1 justify-center items-center px-6">
                            <Text className="text-red-600 text-center text-lg font-semibold mb-2">
                                Error Loading Table
                            </Text>
                            <Text className="text-gray-600 text-center mb-4">
                                {error}
                            </Text>
                            <TouchableOpacity 
                                onPress={fetchTableData}
                                className="bg-blue-500 px-6 py-3 rounded-lg"
                            >
                                <Text className="text-white font-semibold">Retry</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {tableData && !loading && !error && (
                        <ScrollView 
                            horizontal 
                            showsHorizontalScrollIndicator={true}
                            className="flex-1 bg-white"
                        >
                            <ScrollView showsVerticalScrollIndicator={true}>
                                <View className="border border-gray-300 m-4">
                                    {/* Header Row */}
                                    <View className="flex-row bg-gray-100 border-b-2 border-gray-300">
                                        {generateHeaders(tableData.tableData).map((header, colIndex) => (
                                            <View
                                                key={colIndex}
                                                className={`w-32 h-12 px-3 py-2 justify-center border-r border-gray-300 ${colIndex === 0 ? 'bg-gray-200' : 'bg-gray-100'}`}
                                            >
                                                <Text className="text-gray-700 font-bold text-sm text-center">
                                                    {header}
                                                </Text>
                                            </View>
                                        ))}
                                    </View>

                                    {/* Table Rows */}
                                    {tableData.tableData.map((row, rowIndex) => (
                                        <View key={`row-${rowIndex}`} className="flex-row border-b border-gray-200">
                                            {row.map((cell, colIndex) => (
                                                <View
                                                    key={`cell-${rowIndex}-${colIndex}`}
                                                    className={`w-32 h-12 px-3 py-2 justify-center border-r border-gray-200 ${colIndex === 0 ? 'bg-gray-50' : 'bg-white'} ${rowIndex % 2 === 0 ? '' : 'bg-gray-25'}`}
                                                >
                                                    <Text className={`text-sm text-center ${colIndex === 0 ? 'text-gray-600 font-semibold' : 'text-gray-800'}`}>
                                                        {cell || (colIndex === 0 ? row[0] : '-')}
                                                    </Text>
                                                </View>
                                            ))}
                                        </View>
                                    ))}
                                </View>

                                {/* Table Info */}
                                {/* {tableData && (
                                    <View className="px-4 pb-6">
                                        <View className="bg-gray-100 rounded-lg p-4">
                                            <Text className="text-gray-600 text-sm mb-2">
                                                <Text className="font-semibold">Created:</Text> {new Date(tableData.createdAt).toLocaleString()}
                                            </Text>
                                            <Text className="text-gray-600 text-sm">
                                                <Text className="font-semibold">Table ID:</Text> {tableData.id}
                                            </Text>
                                        </View>
                                    </View>
                                )} */}
                            </ScrollView>
                        </ScrollView>
                    )}

                    {tableData && tableData.tableData.length === 0 && !loading && !error && (
                        <View className="flex-1 justify-center items-center">
                            <Text className="text-gray-500 text-lg">No data available</Text>
                        </View>
                    )}
                </View>
            </View>
        </Modal>
    )
}

export default RenderTable;