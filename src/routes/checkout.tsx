import { createFileRoute } from '@tanstack/react-router';
import { PurchasePage } from '@/components/PurchasePage';
import { PasswordRecoveryPage } from '@/components/PasswordRecoveryPage';
export const Route = createFileRoute('/checkout')({ component: () => new URLSearchParams(window.location.search).get('recuperacao') === '1' ? <PasswordRecoveryPage /> : <PurchasePage stage="checkout" /> });
