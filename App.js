import React, { useMemo, useState } from "react";
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, MODULES } from "./src/config";
import { Button } from "./src/components/ui";
import DashboardScreen from "./src/screens/DashboardScreen";
import OperacionesScreen from "./src/screens/OperacionesScreen";
import ScanScreen from "./src/screens/ScanScreen";
import AprobacionesScreen from "./src/screens/AprobacionesScreen";
import InformesScreen from "./src/screens/InformesScreen";
import ClienteScreen from "./src/screens/ClienteScreen";

export default function App() {
  const [active, setActive] = useState("dashboard");
  const [session, setSession] = useState(null);
  const visibleModules = session?.rol === "OPERADOR"
    ? MODULES.filter((item) => item.key === "scan")
    : MODULES;

  const CurrentScreen = useMemo(() => {
    const screens = {
      dashboard: DashboardScreen,
      operaciones: OperacionesScreen,
      scan: ScanScreen,
      aprobaciones: AprobacionesScreen,
      informes: InformesScreen,
      cliente: ClienteScreen
    };
    return screens[active] || DashboardScreen;
  }, [active]);

  function handleLogin(nextSession) {
    setSession(nextSession);
    setActive(nextSession.rol === "OPERADOR" ? "scan" : "dashboard");
  }

  if (!session) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topbar}>
        <View>
          <Text style={styles.brand}>ERP EL SURCO</Text>
          <Text style={styles.user}>{session.nombre} | {session.rol}</Text>
        </View>
        <Button label="Salir" icon="log-out-outline" tone="danger" onPress={() => setSession(null)} />
      </View>

      <View style={styles.content}>
        <CurrentScreen session={session} />
      </View>

      <View style={styles.tabs}>
        {visibleModules.map((item) => {
          const selected = active === item.key;
          return (
            <Text key={item.key} onPress={() => setActive(item.key)} style={[styles.tab, selected && styles.tabActive]}>
              <Ionicons name={item.icon} size={18} color={selected ? COLORS.white : COLORS.text} />{"\n"}
              {item.label}
            </Text>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

function LoginScreen({ onLogin }) {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.login}>
        <Text style={styles.loginTitle}>ERP EL SURCO</Text>
        <Text style={styles.loginSub}>Control movil de buques, cuotas, QR y aprobaciones</Text>
        <View style={styles.loginCard}>
          <Text style={styles.loginLabel}>Seleccione un perfil de prueba</Text>
          <Button label="Supervisor" icon="shield-checkmark-outline" onPress={() => onLogin({ nombre: "Supervisor", rol: "SUPERVISOR" })} />
          <View style={{ height: 10 }} />
          <Button label="Operador patio" icon="qr-code-outline" tone="info" onPress={() => onLogin({ nombre: "Operador Patio", rol: "OPERADOR" })} />
          <View style={{ height: 10 }} />
          <Button label="Cliente" icon="people-outline" tone="success" onPress={() => onLogin({ nombre: "Cliente", rol: "CLIENTE" })} />
        </View>
      </ScrollView>
    </SafeAreaView>
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
    justifyContent: "space-between"
  },
  brand: {
    color: COLORS.text,
    fontWeight: "900",
    fontSize: 18
  },
  user: {
    marginTop: 2,
    color: COLORS.muted,
    fontWeight: "700"
  },
  content: {
    flex: 1
  },
  tabs: {
    flexDirection: "row",
    backgroundColor: COLORS.sidebar,
    paddingVertical: 5
  },
  tab: {
    flex: 1,
    color: COLORS.text,
    textAlign: "center",
    fontSize: 11,
    fontWeight: "800",
    paddingVertical: 5
  },
  tabActive: {
    color: COLORS.white,
    backgroundColor: COLORS.accent
  },
  login: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 20
  },
  loginTitle: {
    fontSize: 34,
    fontWeight: "900",
    color: COLORS.text
  },
  loginSub: {
    marginTop: 8,
    marginBottom: 18,
    color: COLORS.muted,
    fontWeight: "700"
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
  }
});
