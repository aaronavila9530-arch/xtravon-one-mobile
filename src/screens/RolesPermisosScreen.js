import React, { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { api } from "../api/client";
import { Button, Card, EmptyState, Loading, Screen } from "../components/ui";
import { COLORS } from "../config";

export default function RolesPermisosScreen({ session }) {
  const [loading, setLoading] = useState(false);
  const [catalogo, setCatalogo] = useState({ usuarios: [], roles: [], permisos: [] });
  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState(null);
  const [rolesSeleccionados, setRolesSeleccionados] = useState([]);
  const [permisosSeleccionados, setPermisosSeleccionados] = useState([]);
  const [busquedaUsuario, setBusquedaUsuario] = useState("");
  const [busquedaPermiso, setBusquedaPermiso] = useState("");
  const [formUsuario, setFormUsuario] = useState({ nombre: "", usuario: "", email: "" });

  const usuariosFiltrados = useMemo(() => {
    const q = busquedaUsuario.trim().toLowerCase();
    return (catalogo.usuarios || []).filter((usuario) => {
      const texto = `${usuario.nombre} ${usuario.usuario} ${usuario.email || ""}`.toLowerCase();
      return !q || texto.includes(q);
    });
  }, [catalogo.usuarios, busquedaUsuario]);

  const permisosFiltrados = useMemo(() => {
    const q = busquedaPermiso.trim().toLowerCase();
    return (catalogo.permisos || []).filter((permiso) => {
      const texto = `${permiso.codigo} ${permiso.modulo} ${permiso.accion} ${permiso.descripcion || ""}`.toLowerCase();
      return !q || texto.includes(q);
    });
  }, [catalogo.permisos, busquedaPermiso]);

  async function run(label, task) {
    setLoading(label);
    try {
      return await task();
    } catch (error) {
      Alert.alert("Roles y Permisos", error.message);
      return null;
    } finally {
      setLoading(false);
    }
  }

  async function cargarCatalogo() {
    await run("Cargando catalogo...", async () => {
      const data = await api.getRbacCatalogo();
      setCatalogo(data || { usuarios: [], roles: [], permisos: [] });
      setUsuarioSeleccionado(null);
      setRolesSeleccionados([]);
      setPermisosSeleccionados([]);
    });
  }

  async function seleccionarUsuario(usuario) {
    await run("Cargando usuario...", async () => {
      const data = await api.getRbacUsuario(usuario.id);
      setUsuarioSeleccionado(data.usuario);
      setRolesSeleccionados((data.roles || []).map((rol) => rol.id));
      setPermisosSeleccionados((data.permisos || []).map((permiso) => permiso.id));
      setFormUsuario({
        nombre: data.usuario?.nombre || "",
        usuario: data.usuario?.usuario || "",
        email: data.usuario?.email || ""
      });
    });
  }

  async function guardarUsuario() {
    if (!formUsuario.nombre.trim() || !formUsuario.usuario.trim()) {
      Alert.alert("Dato requerido", "Indique nombre y usuario.");
      return;
    }
    await run("Guardando usuario...", async () => {
      await api.crearRbacUsuario({
        nombre: formUsuario.nombre.trim(),
        usuario: formUsuario.usuario.trim(),
        email: formUsuario.email.trim() || null,
        activo: true
      });
      await cargarCatalogo();
      Alert.alert("Roles y Permisos", "Usuario creado o actualizado.");
    });
  }

  async function guardarAsignacion() {
    if (!usuarioSeleccionado?.id) {
      Alert.alert("Seleccione usuario", "Seleccione un usuario del catalogo.");
      return;
    }
    if (rolesSeleccionados.length === 0) {
      Alert.alert("Rol requerido", "Seleccione al menos un rol.");
      return;
    }
    await run("Guardando asignacion...", async () => {
      await api.asignarRbac({
        usuario_id: usuarioSeleccionado.id,
        rol_ids: rolesSeleccionados,
        permiso_ids: permisosSeleccionados
      });
      Alert.alert("Roles y Permisos", "Roles y permisos guardados.");
    });
  }

  function toggleRole(id) {
    setRolesSeleccionados((current) => (
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    ));
  }

  function togglePermiso(id) {
    setPermisosSeleccionados((current) => (
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    ));
  }

  return (
    <Screen
      title="Roles y Permisos"
      subtitle="Usuarios, roles y permisos por modulo. No carga datos hasta presionar Cargar catalogo."
      horizontal={false}
    >
      <ScrollView>
        <Card>
          <View style={styles.actions}>
            <Button label="Cargar catalogo" icon="refresh-outline" onPress={cargarCatalogo} />
            <Button label="Guardar usuario" icon="person-add-outline" tone="info" onPress={guardarUsuario} />
            <Button label="Guardar asignacion" icon="save-outline" tone="success" onPress={guardarAsignacion} disabled={!usuarioSeleccionado} />
          </View>
          {loading && <Loading label={loading} />}
        </Card>

        {!loading && catalogo.usuarios.length === 0 && (
          <EmptyState title="Sin catalogo cargado" subtitle="Presione Cargar catalogo para consultar usuarios, roles y permisos." />
        )}

        {catalogo.usuarios.length > 0 && (
          <>
            <Card>
              <Text style={styles.sectionTitle}>Usuario</Text>
              <View style={styles.formGrid}>
                <InputBox label="Nombre" value={formUsuario.nombre} onChangeText={(value) => setFormUsuario((current) => ({ ...current, nombre: value }))} />
                <InputBox label="Usuario" value={formUsuario.usuario} onChangeText={(value) => setFormUsuario((current) => ({ ...current, usuario: value }))} />
                <InputBox label="Email" value={formUsuario.email} onChangeText={(value) => setFormUsuario((current) => ({ ...current, email: value }))} />
              </View>
              <TextInput
                value={busquedaUsuario}
                onChangeText={setBusquedaUsuario}
                style={styles.input}
                placeholder="Buscar usuario"
                placeholderTextColor={COLORS.auxiliary}
              />
              <View style={styles.listBox}>
                {usuariosFiltrados.slice(0, 25).map((usuario) => (
                  <Pressable
                    key={usuario.id}
                    style={[styles.userRow, usuarioSeleccionado?.id === usuario.id && styles.rowActive]}
                    onPress={() => seleccionarUsuario(usuario)}
                  >
                    <Text style={styles.userName}>{usuario.nombre}</Text>
                    <Text style={styles.userMeta}>{usuario.usuario} {usuario.email ? `| ${usuario.email}` : ""}</Text>
                  </Pressable>
                ))}
              </View>
            </Card>

            <Card>
              <Text style={styles.sectionTitle}>Roles</Text>
              {(catalogo.roles || []).map((rol) => {
                const checked = rolesSeleccionados.includes(rol.id);
                return (
                  <Pressable key={rol.id} style={styles.checkRow} onPress={() => toggleRole(rol.id)}>
                    <Text style={styles.check}>{checked ? "[x]" : "[ ]"}</Text>
                    <View style={styles.checkBody}>
                      <Text style={styles.checkTitle}>{rol.nombre}</Text>
                      <Text style={styles.checkDesc}>{rol.descripcion || "Sin descripcion"}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </Card>

            <Card>
              <View style={styles.headerRow}>
                <Text style={styles.sectionTitle}>Permisos</Text>
                <View style={styles.actionsInline}>
                  <Pressable onPress={() => setPermisosSeleccionados((catalogo.permisos || []).map((item) => item.id))}>
                    <Text style={styles.link}>Marcar todos</Text>
                  </Pressable>
                  <Pressable onPress={() => setPermisosSeleccionados([])}>
                    <Text style={styles.link}>Limpiar</Text>
                  </Pressable>
                </View>
              </View>
              <TextInput
                value={busquedaPermiso}
                onChangeText={setBusquedaPermiso}
                style={styles.input}
                placeholder="Filtrar permiso, modulo o accion"
                placeholderTextColor={COLORS.auxiliary}
              />
              {permisosFiltrados.map((permiso) => {
                const checked = permisosSeleccionados.includes(permiso.id);
                return (
                  <Pressable key={permiso.id} style={styles.checkRow} onPress={() => togglePermiso(permiso.id)}>
                    <Text style={styles.check}>{checked ? "[x]" : "[ ]"}</Text>
                    <View style={styles.checkBody}>
                      <Text style={styles.checkTitle}>{permiso.modulo} | {permiso.accion}</Text>
                      <Text style={styles.checkDesc}>{permiso.codigo} - {permiso.descripcion || ""}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </Card>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

function InputBox({ label, value, onChangeText }) {
  return (
    <View style={styles.inputBox}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        style={styles.input}
        placeholder={label}
        placeholderTextColor={COLORS.auxiliary}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  actionsInline: {
    flexDirection: "row",
    gap: 16
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: "900",
    marginBottom: 10
  },
  formGrid: {
    gap: 10,
    marginBottom: 12
  },
  inputBox: {
    width: "100%"
  },
  label: {
    color: COLORS.text,
    fontWeight: "900",
    marginBottom: 6
  },
  input: {
    minHeight: 42,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bg,
    color: COLORS.text,
    borderRadius: 6,
    paddingHorizontal: 10,
    fontWeight: "800"
  },
  listBox: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    overflow: "hidden"
  },
  userRow: {
    padding: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border
  },
  rowActive: {
    backgroundColor: COLORS.elevated
  },
  userName: {
    color: COLORS.text,
    fontWeight: "900"
  },
  userMeta: {
    marginTop: 3,
    color: COLORS.muted,
    fontWeight: "700"
  },
  checkRow: {
    flexDirection: "row",
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border
  },
  check: {
    width: 34,
    color: COLORS.accent,
    fontWeight: "900"
  },
  checkBody: {
    flex: 1
  },
  checkTitle: {
    color: COLORS.text,
    fontWeight: "900"
  },
  checkDesc: {
    color: COLORS.muted,
    fontWeight: "700",
    marginTop: 3
  },
  link: {
    color: COLORS.accent,
    fontWeight: "900"
  }
});
