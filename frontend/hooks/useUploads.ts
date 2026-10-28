import { useMutation } from "@tanstack/react-query";
import { uploadAccessoryImage, uploadCover, uploadSpine } from "../api/uploads";

// All three carry a File, which can't survive the offline persister's JSON
// serialization — 'always' runs (or fails) immediately instead of being queued
// for whenever the network happens to return (see useImportCsv).
export function useUploadCover() {
  return useMutation({ mutationFn: uploadCover, networkMode: "always" });
}

export function useUploadSpine() {
  return useMutation({ mutationFn: uploadSpine, networkMode: "always" });
}

export function useUploadAccessoryImage() {
  return useMutation({ mutationFn: uploadAccessoryImage, networkMode: "always" });
}
