import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyRoles } from "@/lib/auth/admin.functions";

/** Roles are resolved on the server; the UI only mirrors the result. */
export function useRoles() {
  const fetchRoles = useServerFn(getMyRoles);
  return useQuery({
    queryKey: ["my-roles"],
    queryFn: () => fetchRoles({}),
    staleTime: 60_000,
    retry: false,
  });
}
