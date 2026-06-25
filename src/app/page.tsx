import { redirect } from "next/navigation";

export default function Home() {
  // Redirigir la raíz a la página del hotel "demo" por defecto
  redirect("/demo");
}
