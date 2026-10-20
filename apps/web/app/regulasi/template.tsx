import KolomCatatan from "@/components/KolomCatatan";

export default function RegulasiTemplate({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <KolomCatatan label="Catatan di template" />
      {children}
    </div>
  );
}