import * as React from "react";
import { Linking, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface UserProfileProps {
  user: any;
}

const UserProfile: React.FC<UserProfileProps> = ({ user }) => {
  const mobile = user?.mobileno || user?.mobileNumber || "-";
  const sevakId = user?.sevakid || user?.seid || user?.userId || "-";
  const formatBirthdate = (birthdate?: string | Date) => {
    if (!birthdate) return "-";
    if (typeof birthdate === "string") {
      const parts = birthdate.split("T");
      return parts[0] || birthdate;
    }
    const date = new Date(birthdate);
    if (isNaN(date.getTime())) return "-";
    return date.toISOString().split("T")[0];
  };

  const PersonalInfoField = ({
    icon,
    label,
    value,
    color = "#6B7280",
    last,
  }: {
    icon: any;
    label: string;
    value?: string;
    color?: string;
    last?: boolean;
  }) => (
    <View className={`flex-row items-center justify-between py-3 ${last ? "" : "border-b border-gray-100"}`}>
      <View className="flex-row items-center flex-1">
        <View className="w-10 h-10 rounded-full bg-gray-100 items-center justify-center mr-3">
          <Ionicons name={icon} size={20} color={color} />
        </View>
        <View className="flex-1">
          <Text className="text-gray-500 text-sm">{label}</Text>
          <Text className="text-gray-800 font-medium">{value || "-"}</Text>
        </View>
      </View>
    </View>
  );

  const ContactInfoField = ({
    label,
    contactName,
    contactNumber,
    contactRelation,
    icon,
    last,
  }: {
    label: string;
    contactName?: string;
    contactNumber?: string;
    contactRelation?: string;
    icon: any;
    last?: boolean;
  }) => (
    <TouchableOpacity
      className={`flex-row items-center justify-between py-3 ${last ? "" : "border-b border-gray-100"}`}
      onPress={() => Linking.openURL(`tel:${contactNumber}`)}
      disabled={!contactNumber}
      activeOpacity={contactNumber ? 0.7 : 1}
    >
      <View className="flex-row items-center flex-1">
        <View className="w-10 h-10 rounded-full bg-gray-100 items-center justify-center mr-3">
          <Ionicons name={icon} size={20} color="#ef4444" />
        </View>
        <View className="flex-1">
          <Text className="text-gray-500 text-sm">{label}</Text>
          <Text className="text-gray-800 font-medium">
            {contactName || "-"}
            {contactRelation ? ` (${contactRelation})` : ""}
          </Text>
          <Text className="text-gray-700 mt-1">{contactNumber || "-"}</Text>
        </View>
      </View>
      {contactNumber && <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />}
    </TouchableOpacity>
  );

  return (
    <View className="flex-1 bg-white">
      <ScrollView
        className="flex-1 px-5 pt-2"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        <View className="bg-gray-50 rounded-xl border border-gray-100 p-4">
          <PersonalInfoField icon="person-outline" label="Person Name" value={user?.sevakname} />
          <PersonalInfoField icon="call-outline" label="Mobile Number" value={mobile} color="#0284c7" />
          <PersonalInfoField icon="briefcase-outline" label="Department" value={user?.deptname} />
          <PersonalInfoField icon="finger-print-outline" label="Sevak ID" value={String(sevakId)} />
          <PersonalInfoField icon="calendar-outline" label="Birthdate" value={formatBirthdate(user?.birthdate)} />
          <PersonalInfoField icon="water-outline" label="Blood Group" value={user?.bloodgroup} />

          <ContactInfoField
            label="Emergency Contact 1"
            contactName={user?.emergencycontact1}
            contactRelation={user?.emergencycontactrelation1}
            contactNumber={user?.emrgencycontactno1}
            icon="call-outline"
          />
          <ContactInfoField
            label="Emergency Contact 2"
            contactName={user?.emergencycontact2}
            contactRelation={user?.emergencycontactrelation2}
            contactNumber={user?.emrgencycontactno2}
            icon="call-outline"
            last
          />
        </View>
      </ScrollView>
    </View>
  );
};

export default UserProfile;
