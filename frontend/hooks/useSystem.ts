import { useMutation, useQueryClient } from "@tanstack/react-query";
import { resetDatabase } from "../api/system";

export const useResetDatabase = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (confirmation: string) => resetDatabase(confirmation),
    onSuccess: () => {
      // Everything the UI knew about the library is gone — refetch it all.
      queryClient.invalidateQueries();
    },
  });
};
