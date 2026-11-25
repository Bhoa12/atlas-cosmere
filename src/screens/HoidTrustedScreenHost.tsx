import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { HoidScreen } from "./HoidScreen";
import type { HoidTrustedApplicationBootstrap } from "../hoid/trustedApplicationBootstrap";
import { projectHoidTrustedApplicationScreen } from "../hoid/trustedApplicationScreenProjection";

export type HoidTrustedScreenHostProps = Readonly<{
  /**
   * Creates a fresh bootstrap for this mounted screen session.
   * The host owns and disposes the returned instance on unmount.
   */
  createBootstrap: (() => HoidTrustedApplicationBootstrap | null) | null;
}>;

function statusMessage(
  projection: ReturnType<typeof projectHoidTrustedApplicationScreen>,
): string | null {
  switch (projection.status) {
    case "unconfigured":
      return "La conexión segura de Hoid todavía no está configurada. Las respuestas narrativas permanecen bloqueadas y no se enviarán a proveedores alternativos.";
    case "starting":
      return "Preparando la sesión segura de Hoid…";
    case "loading":
      return "Validando el progreso de lectura y la composición de confianza…";
    case "blocked":
      switch (projection.reason) {
        case "progress-unavailable":
          return "No se puede verificar el progreso de lectura. Hoid bloqueará las respuestas para evitar spoilers.";
        case "invalid-dependencies":
          return "Faltan dependencias nativas de confianza. Las respuestas narrativas siguen bloqueadas.";
        case "composition-unavailable":
        case "screen-port-unavailable":
          return "No se ha podido construir la sesión narrativa segura. No se utilizará un canal alternativo.";
        case "bootstrap-failed":
          return "La inicialización segura ha fallado. Puedes reintentar la validación.";
      }
    case "disposed":
      return "La sesión segura de Hoid se ha cerrado. Vuelve a abrir la pantalla para crear una sesión nueva.";
    case "ready":
      return null;
  }
}

export const HoidTrustedScreenHost: React.FC<HoidTrustedScreenHostProps> = ({
  createBootstrap,
}) => {
  const [bootstrap, setBootstrap] = useState<HoidTrustedApplicationBootstrap | null>(null);
  const [, setRevision] = useState(0);

  useEffect(() => {
    let active = true;
    let ownedBootstrap: HoidTrustedApplicationBootstrap | null = null;

    try {
      ownedBootstrap = createBootstrap?.() ?? null;
    } catch {
      ownedBootstrap = null;
    }
    setBootstrap(ownedBootstrap);

    if (!ownedBootstrap) {
      return () => {
        active = false;
      };
    }

    const unsubscribe = ownedBootstrap.subscribe(() => {
      if (active) setRevision(current => current + 1);
    });

    if (ownedBootstrap.getSnapshot().status === "idle") {
      void ownedBootstrap.initialize();
    }
    setRevision(current => current + 1);

    return () => {
      active = false;
      unsubscribe();
      // HoidScreen disposes its screen port when it unmounts. The host owns
      // the matching bootstrap and closes its remaining resources as well.
      ownedBootstrap?.dispose();
    };
  }, [createBootstrap]);

  const projection = projectHoidTrustedApplicationScreen(
    bootstrap?.getSnapshot() ?? null,
  );
  const screenPort = projection.status === "ready"
    ? projection.screenPort
    : null;
  const message = statusMessage(projection);

  return (
    <View style={styles.container}>
      {message !== null && (
        <View
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          style={styles.statusPanel}
        >
          {projection.status === "starting" || projection.status === "loading"
            ? <ActivityIndicator color="#fbbf24" style={styles.indicator} />
            : null}
          <Text style={styles.statusText}>{message}</Text>
          {projection.status === "blocked" && bootstrap !== null && (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Reintentar inicialización segura de Hoid"
              onPress={() => { void bootstrap.retry(); }}
              style={styles.retryButton}
            >
              <Text style={styles.retryText}>Reintentar validación segura</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      <HoidScreen
        trustedAnswerPort={null}
        trustedConversationPort={screenPort}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#090d16",
  },
  statusPanel: {
    marginHorizontal: 12,
    marginTop: 10,
    marginBottom: 4,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#92400e",
    backgroundColor: "#1c1917",
  },
  indicator: {
    marginBottom: 8,
  },
  statusText: {
    color: "#fde68a",
    fontSize: 12,
    lineHeight: 18,
  },
  retryButton: {
    alignSelf: "flex-start",
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 7,
    backgroundColor: "#78350f",
  },
  retryText: {
    color: "#fff7ed",
    fontSize: 12,
    fontWeight: "700",
  },
});
