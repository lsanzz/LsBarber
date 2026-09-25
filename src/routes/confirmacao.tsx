import { createFileRoute } from '@tanstack/react-router';
import { PurchasePage } from '@/components/PurchasePage';
export const Route = createFileRoute('/confirmacao')({ component: () => <PurchasePage stage="confirmacao" /> });
