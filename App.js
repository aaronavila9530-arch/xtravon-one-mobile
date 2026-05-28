import React, { useEffect, useState } from "react";
import { Alert, BackHandler, Image, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { COLORS, MODULES } from "./src/config";
import GlobalPortia from "./src/components/GlobalPortia";

class ScreenErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.log("ScreenErrorBoundary", error, info);
  }

  componentDidUpdate(prevProps) {
    if (prevProps.active !== this.props.active && this.state.error) {
      this.setState({ error: null });
    }
  }

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <View style={styles.screenError}>
        <Text style={styles.screenErrorTitle}>No se pudo abrir esta pantalla</Text>
        <Text style={styles.screenErrorText}>
          XTRAVON protegió la sesión para evitar que la app se cierre. Vuelva al inicio e intente cargar la pantalla de nuevo.
        </Text>
        <Text style={styles.screenErrorDetail}>{String(this.state.error?.message || this.state.error)}</Text>
        <PlainButton label="Volver al inicio" onPress={this.props.onReset} />
      </View>
    );
  }
}

function loadScreen(key) {
  switch (key) {
    case "dashboard":
      return require("./src/screens/DashboardScreen").default;
    case "operaciones":
      return require("./src/screens/OperacionesScreen").default;
    case "historial": {
      const OperacionesScreen = require("./src/screens/OperacionesScreen").default;
      return (props) => <OperacionesScreen {...props} initialMode="historial" />;
    }
    case "scan":
      return require("./src/screens/ScanScreen").default;
    case "despacho":
      return require("./src/screens/DespachoScreen").default;
    case "aprobaciones":
      return require("./src/screens/AprobacionesScreen").default;
    case "roles":
      return require("./src/screens/RolesPermisosScreen").default;
    case "statement":
      return require("./src/screens/StatementScreen").default;
    case "informes":
      return require("./src/screens/InformesScreen").default;
    case "ai":
      return require("./src/screens/AiScreen").default;
    case "help":
      return require("./src/screens/HelpScreen").default;
    case "chofer":
      return require("./src/screens/ChoferScreen").default;
    case "cliente":
      return require("./src/screens/ClienteScreen").default;
    default:
      return require("./src/screens/DashboardScreen").default;
  }
}

function isPatioOperatorSession(session) {
  const values = [
    session?.rol,
    session?.role,
    session?.perfil,
    ...(Array.isArray(session?.roles) ? session.roles : [])
  ]
    .filter(Boolean)
    .map((value) => String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase());
  return values.some((value) => (
    value === "OPERADOR" ||
    value.includes("OPERADOR_PATIO") ||
    value.includes("OPERADOR DE PATIO") ||
    (value.includes("OPERADOR") && value.includes("PATIO"))
  ));
}

function isDriverSession(session) {
  const values = [
    session?.rol,
    session?.role,
    session?.perfil,
    ...(Array.isArray(session?.roles) ? session.roles : [])
  ]
    .filter(Boolean)
    .map((value) => String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase());
  return values.some((value) => value === "CHOFER" || value === "DRIVER" || value.includes("CAMIONERO"));
}

export default function App() {
  const [active, setActive] = useState("dashboard");
  const [session, setSession] = useState(null);
  const [booting, setBooting] = useState(true);
  const [bootProgress, setBootProgress] = useState(0);
  const updateStatus = "";
  const visibleModules = isDriverSession(session)
    ? MODULES.filter((item) => ["chofer", "help"].includes(item.key))
    : isPatioOperatorSession(session)
      ? MODULES.filter((item) => ["scan", "statement", "help"].includes(item.key))
    : session?.rol === "CLIENTE"
      ? MODULES.filter((item) => ["cliente", "informes", "ai", "help"].includes(item.key))
    : MODULES.filter((item) => !["cliente", "chofer"].includes(item.key));

  useEffect(() => {
    const startedAt = Date.now();
    const timer = setInterval(() => {
      const progress = Math.min((Date.now() - startedAt) / 3000, 1);
      setBootProgress(progress);
      if (progress >= 1) {
        clearInterval(timer);
        setBooting(false);
      }
    }, 80);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      confirmarSalida();
      return true;
    });

    return () => subscription.remove();
  }, [session]);

  function handleLogin(nextSession) {
    setSession(nextSession);
    setActive(
      isDriverSession(nextSession)
        ? "chofer"
        : isPatioOperatorSession(nextSession)
          ? "scan"
          : nextSession.rol === "CLIENTE"
            ? "cliente"
            : "dashboard"
    );
  }

  function confirmarSalida() {
    Alert.alert(
      "Salir del sistema",
      "Desea salir del sistema?",
      [
        { text: "No", style: "cancel" },
        {
          text: "Si",
          style: "destructive",
          onPress: () => {
            if (session) {
              setSession(null);
              setActive("dashboard");
            } else {
              BackHandler.exitApp();
            }
          }
        }
      ]
    );
  }

  if (booting) {
    return <SplashScreen progress={bootProgress} updateStatus={updateStatus} />;
  }

  if (!session) {
    return <LoginScreen onLogin={handleLogin} updateStatus={updateStatus} />;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topbar}>
        <Image source={require("./assets/XTRAVON_seal_round_transparent.png")} style={styles.topbarLogo} resizeMode="contain" />
        <View>
          <Text style={styles.brand}>XTRAVON ONE</Text>
          <Text style={styles.module}>GRAIN CONTROL</Text>
          <Text style={styles.user}>{session.nombre} | {session.rol}</Text>
          {!!updateStatus && <Text style={styles.updateStatus}>{updateStatus}</Text>}
        </View>
        <PlainButton label="Salir" tone="danger" onPress={confirmarSalida} />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.topNav} contentContainerStyle={styles.topNavContent}>
        {visibleModules.map((item) => {
          const selected = active === item.key;
          const label = isPatioOperatorSession(session) && item.key === "scan" ? "Lector QR Patio" : item.label;
          return (
            <Text key={item.key} onPress={() => setActive(item.key)} style={[styles.navItem, selected && styles.navItemActive]}>
              {label}
            </Text>
          );
        })}
      </ScrollView>

      <View style={styles.shell}>
        <View style={styles.content}>
          <ScreenErrorBoundary active={active} onReset={() => setActive(isDriverSession(session) ? "chofer" : "dashboard")}>
            <SafeScreenHost active={active} session={session} onNavigate={setActive} />
          </ScreenErrorBoundary>
        </View>
      </View>
      <GlobalPortia enabled={active !== "ai"} session={session} active={active} />
    </SafeAreaView>
  );
}

function SplashScreen({ progress, updateStatus }) {
  const shineLeft = `${Math.max(-10, Math.min(100, progress * 110 - 5))}%`;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.splash}>
        <Image
          source={require("./assets/xtravon_splash.png")}
          style={styles.splashImage}
          resizeMode="contain"
        />
        <View style={styles.splashProgressWrap}>
          <Text style={styles.splashLabel}>Preparando sistema...</Text>
          {!!updateStatus && <Text style={styles.splashUpdateStatus}>{updateStatus}</Text>}
          <View style={styles.splashProgressBg}>
            <View style={[styles.splashFlareTail, { left: shineLeft }]} />
            <View style={[styles.splashFlareCore, { left: shineLeft }]} />
            <View style={[styles.splashFlareBeam, { left: shineLeft }]} />
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

function SafeScreenHost({ active, session, onNavigate }) {
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    setLoadError(null);
  }, [active]);

  let CurrentScreen = null;
  try {
    CurrentScreen = loadScreen(active);
  } catch (error) {
    if (!loadError) {
      setTimeout(() => setLoadError(error), 0);
    }
  }

  if (loadError || !CurrentScreen) {
    return (
      <View style={styles.screenError}>
        <Text style={styles.screenErrorTitle}>Pantalla protegida</Text>
        <Text style={styles.screenErrorText}>
          XTRAVON no pudo cargar esta pantalla, pero la sesion sigue abierta. Seleccione otra pantalla o vuelva al inicio.
        </Text>
        <Text style={styles.screenErrorDetail}>{String(loadError?.message || loadError || "Modulo no disponible")}</Text>
        <PlainButton label="Volver al inicio" onPress={() => onNavigate(isDriverSession(session) ? "chofer" : "dashboard")} />
      </View>
    );
  }

  return <CurrentScreen session={session} onNavigate={onNavigate} />;
}

function LoginScreen({ onLogin, updateStatus }) {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.login}>
        <Image source={require("./assets/XTRAVON_seal_round_transparent.png")} style={styles.loginLogo} resizeMode="contain" />
        <Text style={styles.loginTitle}>XTRAVON ONE</Text>
        <Text style={styles.loginSub}>GRAIN CONTROL</Text>
        {!!updateStatus && <Text style={styles.loginUpdateStatus}>{updateStatus}</Text>}
        <View style={styles.loginCard}>
          <Text style={styles.loginLabel}>Seleccione un perfil de prueba</Text>
          <PlainButton label="Supervisor" onPress={() => onLogin({ nombre: "Supervisor", rol: "SUPERVISOR" })} />
          <View style={{ height: 10 }} />
          <PlainButton label="Operador patio" tone="info" onPress={() => onLogin({ nombre: "Operador Patio", rol: "OPERADOR" })} />
          <View style={{ height: 10 }} />
          <PlainButton label="Cliente" tone="success" onPress={() => onLogin({ nombre: "Cliente", rol: "CLIENTE" })} />
          <View style={{ height: 10 }} />
          <PlainButton
            label="Chofer Aaron Avila"
            tone="success"
            onPress={() => onLogin({
              nombre: "Aaron Avila Vargas",
              chofer: "Aaron Avila Vargas",
              placa: "ABD084",
              rol: "CHOFER",
            })}
          />
          <View style={{ height: 10 }} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function PlainButton({ label, tone = "accent", onPress, disabled }) {
  const backgroundColor = disabled ? COLORS.elevated : (COLORS[tone] || COLORS.accent);
  const foregroundColor = ["accent", "success", "warning", "info", "teal"].includes(tone) && !disabled
    ? COLORS.bg
    : COLORS.text;
  return (
    <Text
      onPress={disabled ? undefined : onPress}
      style={[styles.plainButton, { backgroundColor, color: foregroundColor }]}
    >
      {label}
    </Text>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.bg
  },
  topbar: {
    backgroundColor: COLORS.topbar,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10
  },
  topbarLogo: {
    width: 54,
    height: 44
  },
  brand: {
    color: COLORS.text,
    fontWeight: "900",
    fontSize: 15
  },
  module: {
    marginTop: 1,
    color: COLORS.accent,
    fontWeight: "900",
    fontSize: 11,
    letterSpacing: 0.5
  },
  user: {
    marginTop: 2,
    color: COLORS.muted,
    fontWeight: "700"
  },
  updateStatus: {
    marginTop: 3,
    color: COLORS.accent,
    fontSize: 10,
    fontWeight: "900"
  },
  shell: {
    flex: 1
  },
  content: {
    flex: 1,
    minWidth: 0
  },
  topNav: {
    maxHeight: 52,
    backgroundColor: COLORS.sidebar,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border
  },
  topNavContent: {
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 7
  },
  navItem: {
    color: COLORS.text,
    textAlign: "center",
    fontSize: 12,
    fontWeight: "800",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 7,
    overflow: "hidden"
  },
  navItemActive: {
    color: COLORS.bg,
    backgroundColor: COLORS.accent
  },
  login: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 20
  },
  loginLogo: {
    width: "100%",
    height: 160,
    marginBottom: 18
  },
  loginTitle: {
    fontSize: 29,
    fontWeight: "900",
    color: COLORS.text
  },
  loginSub: {
    marginTop: 8,
    marginBottom: 18,
    color: COLORS.muted,
    fontWeight: "700"
  },
  loginUpdateStatus: {
    color: COLORS.accent,
    fontWeight: "900",
    marginBottom: 12,
    textAlign: "center"
  },
  loginCard: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 18
  },
  loginLabel: {
    marginBottom: 14,
    color: COLORS.text,
    fontWeight: "900"
  },
  plainButton: {
    minHeight: 44,
    borderRadius: 7,
    paddingHorizontal: 14,
    paddingVertical: 12,
    textAlign: "center",
    overflow: "hidden",
    fontWeight: "900"
  },
  splash: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 28
  },
  splashImage: {
    width: "100%",
    height: "72%"
  },
  splashProgressWrap: {
    marginHorizontal: 18,
    marginTop: 18
  },
  splashLabel: {
    color: COLORS.muted,
    fontWeight: "900",
    marginBottom: 8
  },
  splashUpdateStatus: {
    color: COLORS.accent,
    fontWeight: "900",
    marginBottom: 8
  },
  splashProgressBg: {
    height: 34,
    backgroundColor: "#050B14",
    overflow: "hidden",
    borderRadius: 17
  },
  splashFlareTail: {
    position: "absolute",
    top: 16,
    width: 170,
    height: 2,
    marginLeft: -170,
    backgroundColor: "#00D1FF",
    opacity: 0.55
  },
  splashFlareBeam: {
    position: "absolute",
    top: 17,
    width: 110,
    height: 1,
    marginLeft: 20,
    backgroundColor: "#00D1FF",
    opacity: 0.75
  },
  splashFlareCore: {
    position: "absolute",
    top: 5,
    width: 26,
    height: 24,
    marginLeft: -13,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "#00D1FF",
    backgroundColor: "#00D1FF"
  },
  screenError: {
    margin: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.danger,
    borderRadius: 10,
    backgroundColor: COLORS.card,
    gap: 12
  },
  screenErrorTitle: {
    color: COLORS.danger,
    fontSize: 20,
    fontWeight: "900"
  },
  screenErrorText: {
    color: COLORS.text,
    fontWeight: "800",
    lineHeight: 20
  },
  screenErrorDetail: {
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: "700"
  }
});
