import { createFileRoute } from '@tanstack/react-router';
import { SalesPage } from '@/components/SalesPage';

export const Route = createFileRoute('/apresentacao')({ component: SalesPage });
