import React, { useCallback, useEffect, useRef, useState } from "react";
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

function textoMayus(value) {
  return String(value || "").trim().toUpperCase();
}

function guiaCerrada(guia) {
  if (!guia) return false;
  const estado = textoMayus(guia.estado);
  const estadoAsignacion = textoMayus(guia.estado_asignacion);
  const lecturas = Number(guia.lecturas || 0);
  return (
    lecturas >= 3 ||
    estado === "COMPLETA" ||
    estadoAsignacion === "COMPLETA" ||
    estadoAsignacion === "FINALIZADO" ||
    guia.qr_bloqueado === true ||
    guia.qr_activo === false
  );
}

function guiaListaParaConfirmar(guia) {
  if (!guia || guiaCerrada(guia)) return false;
  return textoMayus(guia.estado_asignacion) === "RESERVADA";
}

function guiaListaParaMostrarQr(guia) {
  if (!guia || guiaCerrada(guia)) return false;
  const estadoAsignacion = textoMayus(guia.estado_asignacion);
  return (
    guia.qr_activo === true &&
    !!guia.qr_image_url &&
    ["ASIGNADA", "EN_PUERTO", "CARGADO"].includes(estadoAsignacion)
  );
}

export default function ChoferScreen({ session }) {
  const { width } = useWindowDimensions();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [working, setWorking] = useState(false);
  const continuidadPromptRef = useRef(null);
  const activeGuideRef = useRef(null);
  const pollingRef = useRef(false);

  const load = useCallback(async (options = {}) => {
    const { silent = false, preserveQr = false } = options || {};
    if (!silent) {
      setLoading(true);
    }
    try {
      const payload = await api.getEstadoChofer({
        chofer: choferNombre(session),
        placa: choferPlaca(session)
      });
      setData(payload);
      if (!preserveQr) {
        setShowQr(false);
      }
    } catch (error) {
      if (!silent) {
        Alert.alert("Estado de chofer", error.message);
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [session]);

  const guiaActivaValida = guiaListaParaMostrarQr(data?.guia_activa) ? data.guia_activa : null;
  const guiaPendienteConfirmacion = guiaListaParaConfirmar(data?.guia_pendiente_confirmacion)
    ? data.guia_pendiente_confirmacion
    : null;
  const guia = guiaActivaValida || guiaPendienteConfirmacion;
  const guiaEstaActiva = !!guiaActivaValida;
  const tieneQr = !!guiaActivaValida?.qr_image_url;
  const resumenChofer = data?.resumen_chofer || {};
  const viajesAsignados = Array.isArray(data?.viajes_asignados) ? data.viajes_asignados : [];
  const viajesArchivados = Array.isArray(data?.viajes_archivados) ? data.viajes_archivados : [];
  const qrSize = Math.min(Math.max(width - 76, 220), 310);

  async function confirmarContinuar(guiaObjetivo = guia) {
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
                base_operacion_id: guiaObjetivo?.id,
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

  async function noContinuar(guiaObjetivo = guia) {
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
                base_operacion_id: guiaObjetivo?.id,
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

  function preguntarContinuidadGuiaActiva(guiaObjetivo) {
    if (!guiaObjetivo?.id || working) return;
    const key = `activa-${guiaObjetivo.id}`;
    if (continuidadPromptRef.current === key) return;
    continuidadPromptRef.current = key;
    setShowQr(false);
    const timer = setTimeout(() => {
      Alert.alert(
        "Viaje completado",
        `El QR anterior fue cerrado. Tiene una nueva guia para ${guiaObjetivo.empresa || "la operacion"} / ${guiaObjetivo.producto || "producto"}. Desea continuar?`,
        [
          {
            text: "No continuar",
            style: "destructive",
            onPress: () => noContinuar(guiaObjetivo)
          },
          {
            text: "Si, continuar",
            onPress: () => {
              activeGuideRef.current = guiaObjetivo.id;
              setShowQr(true);
            }
          }
        ]
      );
    }, 250);
    return () => clearTimeout(timer);
  }

  useEffect(() => {
    const pendiente = guiaPendienteConfirmacion;
    if (!pendiente?.id || working) return;
    if (continuidadPromptRef.current === pendiente.id) return;
    continuidadPromptRef.current = pendiente.id;
    setShowQr(false);
    const timer = setTimeout(() => {
      Alert.alert(
        "Siguiente viaje",
        `Tiene una nueva guia disponible para ${pendiente.empresa || "la operacion"} / ${pendiente.producto || "producto"}. Desea continuar con la operacion?`,
        [
          { text: "No continuar", style: "destructive", onPress: () => noContinuar(pendiente) },
          { text: "Si, continuar", onPress: () => confirmarContinuar(pendiente) }
        ]
      );
    }, 300);
    return () => clearTimeout(timer);
  }, [guiaPendienteConfirmacion?.id, working]);

  useEffect(() => {
    const active = guiaActivaValida;
    if (!active?.id || working) return;
    if (!activeGuideRef.current) {
      activeGuideRef.current = active.id;
      return;
    }
    if (String(activeGuideRef.current) !== String(active.id)) {
      preguntarContinuidadGuiaActiva(active);
    }
  }, [guiaActivaValida?.id, working]);

  useEffect(() => {
    if (!guiaActivaValida?.id || working) return undefined;
    const timer = setInterval(async () => {
      if (pollingRef.current) return;
      pollingRef.current = true;
      try {
        await load({ silent: true, preserveQr: true });
      } finally {
        pollingRef.current = false;
      }
    }, 6000);
    return () => clearInterval(timer);
  }, [guiaActivaValida?.id, working, load]);

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
            <Button label="Buscar mis guias" icon="search-outline" onPress={() => load()} disabled={loading || working} />
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
              <Button
                label={guiaEstaActiva ? "Mostrar QR" : "Si, continuar"}
                icon="checkmark-circle-outline"
                onPress={guiaEstaActiva ? () => {
                  activeGuideRef.current = guia?.id || activeGuideRef.current;
                  setShowQr(true);
                } : () => confirmarContinuar()}
                disabled={working}
              />
              <Button label="No continuo" icon="close-circle-outline" tone="danger" onPress={() => noContinuar()} disabled={working} />
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
