import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { HOID_SOURCE_BIBLIOGRAPHY } from "../hoid/bibliography";
import {
  getDefaultHoidReaderRecommendationPreferences,
  validateHoidReaderRecommendationPreferences,
  type HoidReaderRecommendationPreferences,
  type HoidReaderRecommendationPreferencesStorePort,
} from "../hoid/readerRecommendationPreferences";

export type HoidReaderPreferencesStoreStatus = "loading" | "ready" | "unavailable";

export type HoidReaderPreferencesEditorProps = Readonly<{
  store: HoidReaderRecommendationPreferencesStorePort | null;
  storeStatus: HoidReaderPreferencesStoreStatus;
  onPreferencesChange: (preferences: HoidReaderRecommendationPreferences) => void;
}>;

/**
 * Local-only editor for recommendation ordering. It changes ranking metadata
 * after the signed editorial projection has been authorized; it never changes
 * reading progress, route eligibility or spoiler policy.
 */
export const HoidReaderPreferencesEditor: React.FC<HoidReaderPreferencesEditorProps> = ({
  store,
  storeStatus,
  onPreferencesChange,
}) => {
  const [preferences, setPreferences] = useState(
    getDefaultHoidReaderRecommendationPreferences(),
  );
  const [loaded, setLoaded] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    setLoaded(false);

    if (storeStatus === "loading") {
      setMessage("Conectando con las preferencias locales…");
      return () => { active = false; };
    }
    if (storeStatus !== "ready" || !store) {
      setMessage("Almacenamiento local no disponible. Se conservará el orden editorial original.");
      return () => { active = false; };
    }

    setMessage("Cargando preferencias guardadas…");
    void store.read().then(raw => {
      if (!active) return;
      const validation = validateHoidReaderRecommendationPreferences(raw);
      if (validation.status !== "valid") {
        setMessage("Las preferencias guardadas no superan la validación. No se han restablecido ni sobrescrito.");
        return;
      }
      setPreferences(validation.preferences);
      onPreferencesChange(validation.preferences);
      setLoaded(true);
      setMessage("Preferencias guardadas localmente en este dispositivo.");
    }).catch(() => {
      if (!active) return;
      setMessage("No se pudieron leer las preferencias. Se conservará el orden editorial original.");
    });

    return () => { active = false; };
  }, [store, storeStatus, onPreferencesChange]);

  const persist = async (candidate: unknown) => {
    if (!store || !loaded || saving) return;
    const validation = validateHoidReaderRecommendationPreferences(candidate);
    if (validation.status !== "valid" ||
        validation.preferences.revision !== preferences.revision + 1) {
      setMessage("El cambio no supera la validación de preferencias.");
      return;
    }

    setSaving(true);
    setMessage("Guardando preferencias locales…");
    try {
      const result = await store.compareAndSwap(preferences.revision, validation.preferences);
      if (result === "saved") {
        setPreferences(validation.preferences);
        onPreferencesChange(validation.preferences);
        setMessage("Preferencias guardadas. El progreso y los permisos de spoilers no han cambiado.");
      } else if (result === "conflict") {
        const latest = validateHoidReaderRecommendationPreferences(await store.read());
        if (latest.status === "valid") {
          setPreferences(latest.preferences);
          onPreferencesChange(latest.preferences);
          setMessage("Las preferencias cambiaron en otra sesión. Se ha cargado la versión más reciente; vuelve a aplicar tu cambio.");
        } else {
          setLoaded(false);
          setMessage("Se detectó un conflicto y el registro ya no es válido. No se ha sobrescrito.");
        }
      } else {
        setMessage("El almacenamiento no confirmó el cambio. Las preferencias anteriores se mantienen.");
      }
    } catch {
      setMessage("No se pudo guardar el cambio. Las preferencias anteriores se mantienen.");
    } finally {
      setSaving(false);
    }
  };

  const setWorkDisposition = (
    workId: string,
    disposition: "priority" | "deprioritized",
  ) => {
    const current = preferences;
    const priorityWorkIds = [...current.priorityWorkIds];
    const deprioritizedWorkIds = [...current.deprioritizedWorkIds];

    if (disposition === "priority") {
      const index = priorityWorkIds.indexOf(workId);
      if (index >= 0) priorityWorkIds.splice(index, 1);
      else priorityWorkIds.push(workId);
      const deferredIndex = deprioritizedWorkIds.indexOf(workId);
      if (deferredIndex >= 0) deprioritizedWorkIds.splice(deferredIndex, 1);
    } else {
      const index = deprioritizedWorkIds.indexOf(workId);
      if (index >= 0) deprioritizedWorkIds.splice(index, 1);
      else deprioritizedWorkIds.push(workId);
      const priorityIndex = priorityWorkIds.indexOf(workId);
      if (priorityIndex >= 0) priorityWorkIds.splice(priorityIndex, 1);
    }

    void persist(Object.freeze({
      schemaVersion: 1 as const,
      revision: current.revision + 1,
      priorityWorkIds: Object.freeze(priorityWorkIds),
      deprioritizedWorkIds: Object.freeze(deprioritizedWorkIds),
      maxItems: current.maxItems,
    }));
  };

  const setMaxItems = (maxItems: 1 | 3 | 5) => {
    if (maxItems === preferences.maxItems) return;
    void persist(Object.freeze({
      schemaVersion: 1 as const,
      revision: preferences.revision + 1,
      priorityWorkIds: preferences.priorityWorkIds,
      deprioritizedWorkIds: preferences.deprioritizedWorkIds,
      maxItems,
    }));
  };

  const reset = () => {
    void persist(Object.freeze({
      schemaVersion: 1 as const,
      revision: preferences.revision + 1,
      priorityWorkIds: Object.freeze([]),
      deprioritizedWorkIds: Object.freeze([]),
      maxItems: 5 as const,
    }));
  };

  const canEdit = loaded && !saving && storeStatus === "ready";

  return (
    <View style={styles.panel}>
      <Text style={styles.title}>PREFERENCIAS DE LECTURA</Text>
      <Text style={styles.note}>
        Ordenan únicamente recomendaciones ya autorizadas. No añaden obras, no desbloquean capítulos y no cambian la protección contra spoilers.
      </Text>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityState={{ disabled: !canEdit }}
        disabled={!canEdit}
        onPress={() => setExpanded(value => !value)}
        style={[styles.toggle, !canEdit && styles.disabled]}
      >
        <Text style={styles.toggleText}>
          {expanded ? "Ocultar preferencias" : "Configurar preferencias"}
        </Text>
      </TouchableOpacity>

      {(!loaded || saving) && (
        <View style={styles.statusRow}>
          <ActivityIndicator color="#818cf8" size="small" />
          <Text style={styles.status}>{message}</Text>
        </View>
      )}
      {loaded && !saving && message.length > 0 && (
        <Text accessibilityLiveRegion="polite" style={styles.status}>{message}</Text>
      )}

      {expanded && canEdit && (
        <View>
          <Text style={styles.sectionTitle}>Número máximo de resultados</Text>
          <View style={styles.limitRow}>
            {([1, 3, 5] as const).map(limit => (
              <TouchableOpacity
                key={limit}
                accessibilityRole="button"
                accessibilityState={{ selected: preferences.maxItems === limit, disabled: saving }}
                disabled={saving}
                onPress={() => setMaxItems(limit)}
                style={[styles.limitButton, preferences.maxItems === limit && styles.selected]}
              >
                <Text style={styles.actionText}>{limit}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.sectionTitle}>Prioridad de obras</Text>
          <Text style={styles.note}>
            El orden se establece al activar cada prioridad. Para cambiarlo, quita la prioridad y vuelve a añadirla.
          </Text>
          <ScrollView
            style={styles.workList}
            nestedScrollEnabled
            showsVerticalScrollIndicator
          >
            {HOID_SOURCE_BIBLIOGRAPHY.map(work => {
              const priorityIndex = preferences.priorityWorkIds.indexOf(work.id);
              const deprioritized = preferences.deprioritizedWorkIds.includes(work.id);
              const disposition = priorityIndex >= 0
                ? `Prioridad ${priorityIndex + 1}`
                : deprioritized ? "Menor prioridad" : "Sin preferencia";
              return (
                <View key={work.id} style={styles.workRow}>
                  <View style={styles.workIdentity}>
                    <Text style={styles.workTitle}>{work.title}</Text>
                    <Text style={styles.workDisposition}>{disposition}</Text>
                  </View>
                  <View style={styles.actions}>
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel={priorityIndex >= 0 ? `Quitar prioridad a ${work.title}` : `Priorizar ${work.title}`}
                      disabled={saving}
                      onPress={() => setWorkDisposition(work.id, "priority")}
                      style={[styles.actionButton, priorityIndex >= 0 && styles.selected]}
                    >
                      <Text style={styles.actionText}>{priorityIndex >= 0 ? "Quitar" : "Priorizar"}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel={deprioritized ? `Restaurar prioridad neutral de ${work.title}` : `Dar menor prioridad a ${work.title}`}
                      disabled={saving}
                      onPress={() => setWorkDisposition(work.id, "deprioritized")}
                      style={[styles.actionButton, deprioritized && styles.deprioritized]}
                    >
                      <Text style={styles.actionText}>{deprioritized ? "Restaurar" : "Posponer"}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </ScrollView>

          <TouchableOpacity
            accessibilityRole="button"
            disabled={saving}
            onPress={reset}
            style={[styles.resetButton, saving && styles.disabled]}
          >
            <Text style={styles.actionText}>Restablecer preferencias</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  panel: { padding: 12, backgroundColor: "#0d1526", borderBottomWidth: 1, borderColor: "#1e293b" },
  title: { color: "#e2e8f0", fontSize: 11, fontWeight: "900", letterSpacing: 1.1 },
  note: { color: "#94a3b8", fontSize: 10, lineHeight: 15, marginTop: 4 },
  toggle: { alignSelf: "flex-start", marginTop: 9, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14, backgroundColor: "#312e81" },
  toggleText: { color: "#ffffff", fontSize: 10, fontWeight: "700" },
  statusRow: { flexDirection: "row", alignItems: "center", marginTop: 8, gap: 8 },
  status: { color: "#c7d2fe", fontSize: 10, lineHeight: 15, marginTop: 7 },
  sectionTitle: { color: "#cbd5e1", fontSize: 10, fontWeight: "800", marginTop: 12 },
  limitRow: { flexDirection: "row", gap: 7, marginTop: 7 },
  limitButton: { minWidth: 42, alignItems: "center", paddingHorizontal: 12, paddingVertical: 7, borderRadius: 12, borderWidth: 1, borderColor: "#475569", backgroundColor: "#111827" },
  selected: { borderColor: "#818cf8", backgroundColor: "#312e81" },
  workList: { maxHeight: 230, marginTop: 7 },
  workRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, paddingVertical: 7, borderTopWidth: 1, borderTopColor: "#26344d" },
  workIdentity: { flex: 1 },
  workTitle: { color: "#e2e8f0", fontSize: 10, fontWeight: "600" },
  workDisposition: { color: "#94a3b8", fontSize: 9, marginTop: 2 },
  actions: { flexDirection: "row", gap: 4 },
  actionButton: { paddingHorizontal: 7, paddingVertical: 6, borderRadius: 9, borderWidth: 1, borderColor: "#475569", backgroundColor: "#111827" },
  deprioritized: { borderColor: "#b45309", backgroundColor: "#451a03" },
  actionText: { color: "#e2e8f0", fontSize: 9, fontWeight: "700" },
  resetButton: { alignSelf: "flex-start", marginTop: 10, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10, backgroundColor: "#334155" },
  disabled: { opacity: 0.45 },
});
