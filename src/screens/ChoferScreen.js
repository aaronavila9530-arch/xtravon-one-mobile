import React, { useCallback, useState } from "react";
import { Alert, Image, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { api } from "../api/client";
import { COLORS } from "../config";
import { Button, Card, EmptyState, Loading, Row, Screen } from "../components/ui";

function formatNumber(value) {
  return Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function choferNombre(session) {
  return session?.chofer || session?.nombre || "Aaron Avila";
}

function choferPlaca(session) {
  return session?.placa || "";
}

export default function ChoferScreen({ session }) {
  const { width } = useWindowDimensions();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [working, setWorking] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const payload = await api.getEstadoChofer({
        chofer: choferNombre(session),
        placa: choferPlaca(session)
      });
      setData(payload);
      setShowQr(false);
    } catch (error) {
      Alert.alert("Estado de chofer", error.message);
    } finally {
      setLoading(false);
    }
  }, [session]);

  const guia = data?.guia_activa || data?.guia_pendiente_confirmacion;
  const guiaEstaActiva = !!data?.guia_activa;
  const tieneQr = guiaEstaActiva && !!guia?.qr_image_url;
  const resumenChofer = data?.resumen_chofer || {};
  const viajesAsignados = Array.isArray(data?.viajes_asignados) ? data.viajes_asignados : [];
  const viajesArchivados = Array.isArray(data?.viajes_archivados) ? data.viajes_archivados : [];
  const qrSize = Math.min(Math.max(width - 76, 220), 310);

  async function confirmarContinuar() {
    Alert.alert(
      "Continuar operacion",
      "Se habilitara el siguiente QR asignado por despacho. Confirme que continuara con este viaje.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Confirmar",
          onPress: async () => {
            setWorking(true);
            try {
              const result = await api.confirmarContinuidadChofer({
                chofer: choferNombre(session),
                placa: choferPlaca(session),
                operacion_id: data?.operacion?.id,
                base_operacion_id: guia?.id,
                continuar: true,
                comentario: "Chofer confirma continuidad desde app."
              });
              Alert.alert("QR habilitado", result?.mensaje || "El siguiente QR fue habilitado.");
              await load();
              setShowQr(true);
            } catch (error) {
              Alert.alert("Continuar operacion", error.message);
            } finally {
              setWorking(false);
            }
          }
        }
      ]
    );
  }

  async function noContinuar() {
    Alert.alert(
      "No continuar",
      "Esta accion avisara al ERP que no continuara. Las guias pendientes quedaran en despacho para reasignacion manual.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Confirmar",
          style: "destructive",
          onPress: async () => {
            setWorking(true);
            try {
              const result = await api.confirmarContinuidadChofer({
                chofer: choferNombre(session),
                placa: choferPlaca(session),
                operacion_id: data?.operacion?.id,
                base_operacion_id: guia?.id,
                continuar: false,
                comentario: "Chofer no continua desde app."
              });
              Alert.alert("Operacion actualizada", result?.mensaje || "Se registro que no continua.");
              await load();
            } catch (error) {
              Alert.alert("No continuar", error.message);
            } finally {
              setWorking(false);
            }
          }
        }
      ]
    );
  }

  async function solicitarNuevoViaje() {
    setWorking(true);
    try {
      const result = await api.solicitarNuevoViaje({
        chofer: choferNombre(session),
        placa: choferPlaca(session),
        operacion_id: data?.operacion?.id,
        base_operacion_id: guia?.id,
        comentario: "Chofer solicita viajes adicionales desde app."
      });
      Alert.alert("Solicitud enviada", result?.mensaje || "Despacho recibio la solicitud.");
      await load();
    } catch (error) {
      Alert.alert("Solicitud", error.message);
    } finally {
      setWorking(false);
    }
  }

  return (
    <Screen
      title="Portal Chofer"
      subtitle="Muestra solo el QR vigente y los viajes asignados a este chofer."
      minWidth={0}
      horizontal={false}
    >
      <ScrollView
        horizontal={false}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <Card>
          <Text style={styles.driverName}>{choferNombre(session)}</Text>
          <Text style={styles.driverMeta}>{data?.operacion?.nombre_buque || "Operacion no consultada"} {data?.operacion?.estado ? `| ${data.operacion.estado}` : ""}</Text>
          <View style={styles.searchAction}>
            <Button label="Buscar mis guias" icon="search-outline" onPress={load} disabled={loading || working} />
          </View>
          {!data && (
            <View style={styles.searchPrompt}>
              <Text style={styles.searchPromptTitle}>Consulta manual</Text>
              <Text style={styles.searchPromptText}>Esta pantalla no consulta el backend al abrir. Presione Buscar mis guias para cargar el QR vigente y sus viajes.</Text>
            </View>
          )}
        </Card>

        {loading && !data ? (
          <Loading label="Consultando guias asignadas..." />
        ) : !data ? null : !guia ? (
          <Card>
            <EmptyState
              title="Sin QR activo"
              subtitle="No hay una guia vigente asignada para este chofer."
              icon="qr-code-outline"
            />
            <Button label="Solicitar viajes" icon="send-outline" tone="info" onPress={solicitarNuevoViaje} disabled={working} />
          </Card>
        ) : !showQr ? (
          <Card>
            <Text style={styles.cardTitle}>{guiaEstaActiva ? "QR vigente asignado" : "Siguiente guia pendiente"}</Text>
            <Row label="Chofer" value={guia.chofer_asignado || guia.chofer || choferNombre(session)} />
            <Row label="Cliente" value={guia.empresa} />
            <Row label="Producto" value={guia.producto} />
            <Text style={styles.prompt}>
              {guiaEstaActiva
                ? "Desea mostrar el QR vigente?"
                : "Desea continuar con la operacion y habilitar este QR?"}
            </Text>
            <View style={styles.actions}>
              <Button label={guiaEstaActiva ? "Mostrar QR" : "Si, continuar"} icon="checkmark-circle-outline" onPress={guiaEstaActiva ? () => setShowQr(true) : confirmarContinuar} disabled={working} />
              <Button label="No continuo" icon="close-circle-outline" tone="danger" onPress={noContinuar} disabled={working} />
            </View>
          </Card>
        ) : (
          <Card>
            <Text style={styles.cardTitle}>QR vigente</Text>
            <View style={styles.qrWrap}>
              {tieneQr ? (
                <Image
                  source={{ uri: guia.qr_image_url }}
                  style={[styles.qrImage, { width: qrSize, height: qrSize }]}
                  resizeMode="contain"
                />
              ) : (
                <EmptyState title="QR no disponible" subtitle="Despacho debe activar o regenerar esta guia." />
              )}
            </View>
            <Row label="Chofer" value={guia.chofer_asignado || guia.chofer || choferNombre(session)} />
            <Row label="Cliente" value={guia.empresa} />
            <Row label="Producto" value={guia.producto} />
          </Card>
        )}

        {data && (
          <Card>
            <Text style={styles.cardTitle}>Mi avance</Text>
            <View style={styles.summaryGrid}>
              <View style={styles.summaryCell}>
                <Text style={styles.summaryLabel}>Asignados</Text>
                <Text style={styles.summaryValue}>{formatNumber(resumenChofer.viajes_asignados_total)}</Text>
              </View>
              <View style={styles.summaryCell}>
                <Text style={styles.summaryLabel}>Pendientes</Text>
                <Text style={styles.summaryValue}>{formatNumber(resumenChofer.viajes_pendientes_total)}</Text>
              </View>
              <View style={styles.summaryCell}>
                <Text style={styles.summaryLabel}>Completados</Text>
                <Text style={styles.summaryValue}>{formatNumber(resumenChofer.viajes_completados_total)}</Text>
              </View>
              <View style={styles.summaryCell}>
                <Text style={styles.summaryLabel}>Descargado MT</Text>
                <Text style={styles.summaryValue}>{formatNumber(resumenChofer.peso_descargado_mt)}</Text>
              </View>
              <View style={styles.summaryCellWide}>
                <Text style={styles.summaryLabel}>Promedio por viaje</Text>
                <Text style={styles.summaryValue}>{formatNumber(resumenChofer.peso_promedio_mt)} MT</Text>
              </View>
            </View>
          </Card>
        )}

        <Card>
          <Text style={styles.cardTitle}>Viajes asignados</Text>
          <Text style={styles.muted}>
            {data
              ? `${viajesAsignados.length} viaje(s) en cola para este chofer. Solo se muestra un QR vigente por ciclo.`
              : "Presione Buscar mis guias para ver sus viajes asignados."}
          </Text>
        </Card>

        <Card>
          <Text style={styles.cardTitle}>Archivados del dia</Text>
          <Text style={styles.muted}>
            {data
              ? `${viajesArchivados.length} viaje(s) completado(s) hoy. Los QR completados quedan archivados y no se muestran.`
              : "Presione Buscar mis guias para ver archivados."}
          </Text>
        </Card>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  driverName: {
    color: COLORS.text,
    fontSize: 21,
    fontWeight: "900"
  },
  content: {
    width: "100%",
    paddingBottom: 24
  },
  driverMeta: {
    marginTop: 4,
    color: COLORS.muted,
    fontWeight: "800"
  },
  notice: {
    marginTop: 12,
    padding: 10,
    borderRadius: 8,
    backgroundColor: COLORS.elevated,
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  noticeText: {
    color: COLORS.warning,
    fontWeight: "900",
    flex: 1
  },
  searchAction: {
    marginTop: 12,
    alignSelf: "flex-start"
  },
  searchPrompt: {
    marginTop: 14,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.elevated,
    gap: 8
  },
  searchPromptTitle: {
    color: COLORS.accent,
    fontWeight: "900"
  },
  searchPromptText: {
    color: COLORS.muted,
    fontWeight: "700",
    lineHeight: 19
  },
  cardTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 10
  },
  prompt: {
    color: COLORS.accent,
    fontWeight: "900",
    marginTop: 12,
    marginBottom: 8
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 12
  },
  qrWrap: {
    alignItems: "center",
    alignSelf: "center",
    width: "100%",
    marginBottom: 12,
    overflow: "hidden"
  },
  qrImage: {
    backgroundColor: COLORS.white,
    borderRadius: 8
  },
  muted: {
    color: COLORS.muted,
    fontWeight: "700"
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  summaryCell: {
    flexGrow: 1,
    flexBasis: "30%",
    minWidth: 96,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.elevated
  },
  summaryCellWide: {
    flexGrow: 1,
    flexBasis: "60%",
    minWidth: 180,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.elevated
  },
  summaryLabel: {
    color: COLORS.muted,
    fontWeight: "800",
    fontSize: 12
  },
  summaryValue: {
    marginTop: 4,
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "900"
  },
  quotaRow: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  quotaTitle: {
    color: COLORS.text,
    fontWeight: "900"
  },
  quotaPct: {
    color: COLORS.accent,
    fontWeight: "900"
  },
  tripRow: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingVertical: 9
  },
  tripGuide: {
    color: COLORS.accent,
    fontWeight: "900"
  },
  tripText: {
    marginTop: 2,
    color: COLORS.muted,
    fontWeight: "700"
  }
});
