import PropertyPageClient from '@/components/PropertyPageClient';

interface Props {
  params: { address: string };
}

export default function PropertyPage({ params }: Props) {
  const address = decodeURIComponent(params.address);
  return <PropertyPageClient address={address} />;
}