import { login } from "@/api/auth";
import * as React from "react";
import { View, Text, TextInput, Button, StyleSheet } from "react-native";
import { useState } from "react";

export default function LoginFormWeb() {
  const [mobileNumber, setMobileNumber] = useState("");
  const [password, setPassword] = useState("");
  return (
    <View>
      <Text style={styles.title}>Login Form</Text>
      <TextInput style={styles.input} placeholder="Mobile Number" value={mobileNumber} onChangeText={setMobileNumber} />
      <TextInput style={styles.input} placeholder="Password" value={password} onChangeText={setPassword} />
      <Button title="Login" onPress={() => {
        login(mobileNumber.trim(), password.trim());
      }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: "gray",
    padding: 10,
    marginBottom: 10,
  },
});