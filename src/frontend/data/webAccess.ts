import { queryOptions } from '@tanstack/react-query';

import type { WebAccessModule } from '@/shared/contracts/webAccess';

export const webAccessQueryKeys = {
  status: () => ['webAccess', 'status'] as const,
};

export function webAccessQueryOptions(webAccess: WebAccessModule) {
  return queryOptions({
    queryKey: webAccessQueryKeys.status(),
    queryFn: () => webAccess.getStatus(),
    staleTime: 60_000,
    gcTime: 60_000,
    retry: false,
  });
}
