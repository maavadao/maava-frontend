import { redirect } from 'next/navigation';

export default function CommunitiesPage() {
  redirect('/marketplace?tab=communities');
}
