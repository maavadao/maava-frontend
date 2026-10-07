import { redirect } from 'next/navigation';

export default function CommunitiesPage() {
  redirect('/workspace?tab=communities');
}
