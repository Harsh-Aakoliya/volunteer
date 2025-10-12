import { TextInput, View, Text, Pressable } from "react-native";
import { InputProps } from "../../types/type";
import * as React from 'react';
const CustomInput = ({
    label,
    error,
    className = "",
    containerClassName = "",
    leftIcon,
    rightIcon,
    touched,
    ...props
}: InputProps) => {
    return (
        <View className={`w-full ${containerClassName}`}>
            {label && (
                <Text className="text-gray-700 text-sm mb-1.5 font-medium">
                    {label}
                </Text>
            )}
            <View className={`
                flex-row items-center bg-gray-50 rounded-xl px-4
                ${error && touched ? 'border-red-500 border' : 'border-transparent border'}
            `}>
                {leftIcon}
                <TextInput
                    className={`
                        flex-1 py-3.5 text-gray-800 text-base
                        ${leftIcon ? 'ml-3' : ''}
                        ${rightIcon ? 'mr-3' : ''}
                        ${className}
                    `}
                    placeholderTextColor="#9CA3AF"
                    {...props}
                />
                {rightIcon}
            </View>
            {error && touched && (
                <Text className="text-red-500 text-sm mt-1">
                    {error}
                </Text>
            )}
        </View>
    );
};

export default CustomInput;