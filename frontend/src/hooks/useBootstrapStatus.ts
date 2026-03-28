import { useQuery } from "@tanstack/react-query";
import api from "../api/axios";

interface BootstrapStatus {
    initial_setup_required: boolean;
}

export function useBootstrapStatus() {
    return useQuery<BootstrapStatus>({
        queryKey: ["bootstrapStatus"],
        queryFn: async () => {
            const { data } = await api.get("/auth/bootstrap-status");
            return data;
        },
        retry: false,
    });
}
