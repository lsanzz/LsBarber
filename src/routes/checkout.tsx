import { createFileRoute } from '@tanstack/react-router';
import { PurchasePage } from '@/components/PurchasePage';
export const Route = createFileRoute('/checkout')({ component: () => <PurchasePage stage="checkout" /> });
