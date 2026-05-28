const isHandheld = process.env.EXPO_PUBLIC_DEVICE_VARIANT === "handheld";

module.exports = {
  dependencies: {
    "react-native-datawedge-intents": isHandheld
      ? {}
      : {
          platforms: {
            android: null,
            ios: null,
          },
        },
  },
};
