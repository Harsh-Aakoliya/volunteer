import React from "react";
import { Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { ButtonProps } from "../../types/type";

const getBgVariantStyle = (bgVariant: ButtonProps['bgVariant']) => {
    switch(bgVariant){ 
        case "outline":
            return "bg-transparent border-neutral-300 border-[1px]"
        case "secondary":
            return "bg-gray-500"
        case "danger":
            return "bg-red-500"
        case "success":
            return "bg-green-500"
        default:
            return "bg-[#0286ff]"
    }
}

const getTextVariantStyle = (textVariant: ButtonProps['textVariant']) => {
    switch(textVariant){ 
        case "primary":
            return "text-black"
        case "secondary":
            return "text-gray-100"
        case "danger":
            return "text-red-100"
        case "success":
            return "text-green-100"
        default:
            return "text-white"
    }
}

const CustomButton = ({
    onPress,
    title,
    bgVariant = "primary",
    textVariant = "default",
    IconLeft,
    IconRight,
    className = "",
    disabled,
    loading,
    ...props
}: ButtonProps) => (
    <TouchableOpacity 
        onPress={onPress}
        disabled={disabled || loading}
        className={`
            rounded-xl flex flex-row justify-center items-center p-2
            ${getBgVariantStyle(bgVariant)}
            ${disabled || loading ? 'opacity-50' : ''}
            ${className}
        `}
        {...props}
    >
        {loading ? (
            <ActivityIndicator color={textVariant === "primary" ? "#000" : "#fff"} />
        ) : (
            <>
                {IconLeft && <IconLeft />}
                <Text className={`text-base font-semibold ${getTextVariantStyle(textVariant)} ${IconLeft ? 'ml-2' : ''} ${IconRight ? 'mr-2' : ''}`}>
                    {title}
                </Text>
                {IconRight && <IconRight />}
            </>
        )}
    </TouchableOpacity>
); 

export default CustomButton;