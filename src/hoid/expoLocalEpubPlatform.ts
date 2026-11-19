import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import { createHoidEpubIngestionService } from "./epubIngestion";
import { createHoidEpubRangeRuntimePorts } from "./epubRangeRuntimeAdapters";
import { createHoidExpoLocalEpubProvider } from "./expoLocalEpubProvider";

/**
 * Expo SDK 51 composition root. Keep this module at the platform edge:
 * the Hoid core and its tests depend only on injected ports.
 */
export function createHoidExpoLocalEpubRuntime() {
  const provider = createHoidExpoLocalEpubProvider({
    picker: {
      getDocumentAsync: options => DocumentPicker.getDocumentAsync(options),
    },
    fileSystem: {
      cacheDirectory: FileSystem.cacheDirectory,
      getInfoAsync: (uri, options) => FileSystem.getInfoAsync(uri, options),
      readAsStringAsync: (uri, options) => FileSystem.readAsStringAsync(uri, options),
      deleteAsync: (uri, options) => FileSystem.deleteAsync(uri, options),
    },
  });

  const ingestion = createHoidEpubIngestionService(
    createHoidEpubRangeRuntimePorts(provider.resolveRangeSource),
  );

  return Object.freeze({ provider, ingestion });
}
