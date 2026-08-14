import { Suspense } from 'react';

import { AdminTournamentsPage } from '@/components/admin/admin-tournaments-page';

export default function AdminTournamentsRoute() {
  return (
    <Suspense fallback={null}>
      <AdminTournamentsPage />
    </Suspense>
  );
}
