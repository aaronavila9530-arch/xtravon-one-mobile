const variant = process.env.EXPO_PUBLIC_DEVICE_VARIANT || "celular";
const isHandheld = variant === "handheld";

const androidPackage = isHandheld ? "com.xtravon.one.handheld" : "com.xtravon.one.celular";
const iosBundleIdentifier = isHandheld ? "com.xtravon.one.handheld" : "com.xtravon.one.celular";
const appName = isHandheld ? "XTRAVON Handheld" : "XTRAVON One";
const appVersion = "0.1.2";
const runtimeVersion = process.env.EXPO_PUBLIC_RUNTIME_VERSION || `${appVersion}-${variant}`;

module.exports = {
  expo: {
    name: appName,
    slug: "erp-el-surco-mobile",
    newArchEnabled: false,
    icon: "./assets/XTRAVON_seal_round_transparent.png",
    version: appVersion,
    orientation: "portrait",
    scheme: "xtravon",
    userInterfaceStyle: "dark",
    runtimeVersion,
    updates: {
      enabled: true,
      url: "https://u.expo.dev/85ba4aaa-3461-4f15-96e9-013c083e7bc7",
      checkAutomatically: "ON_LOAD",
      fallbackToCacheTimeout: 0
    },
    splash: {
      image: "./assets/xtravon_splash.png",
      resizeMode: "contain",
      backgroundColor: "#050B14"
    },
    assetBundlePatterns: ["**/*"],
    ios: {
      supportsTablet: true,
      bundleIdentifier: iosBundleIdentifier,
      infoPlist: {
        NSMicrophoneUsageDescription: "XTRAVON ONE usa el microfono para dictar preguntas a P.O.R.T.I.A.",
        NSSpeechRecognitionUsageDescription: "XTRAVON ONE usa reconocimiento de voz para consultar P.O.R.T.I.A."
      }
    },
    android: {
      package: androidPackage,
      adaptiveIcon: {
        foregroundImage: "./assets/XTRAVON_seal_round_transparent.png",
        backgroundColor: "#050B14"
      },
      permissions: ["android.permission.CAMERA", "android.permission.RECORD_AUDIO"]
    },
    plugins: [
      "expo-updates",
      "expo-font",
      [
        "expo-camera",
        {
          cameraPermission: "XTRAVON ONE usa la camara para escanear QR de guias."
        }
      ],
      [
        "expo-image-picker",
        {
          photosPermission: "XTRAVON ONE usa fotos como evidencia documental."
        }
      ],
      [
        "expo-speech-recognition",
        {
          microphonePermission: "XTRAVON ONE usa el microfono para dictar preguntas a P.O.R.T.I.A.",
          speechRecognitionPermission: "XTRAVON ONE usa reconocimiento de voz para consultar P.O.R.T.I.A."
        }
      ]
    ],
    extra: {
      deviceVariant: variant,
      eas: {
        projectId: "85ba4aaa-3461-4f15-96e9-013c083e7bc7"
      }
    }
  }
};
