import { HomeView } from "@/components/HomeView";
import HolographicObject from "@/components/Hologram/HolographicObject";

export default function HomePage() {
  return (
    <>
      <HomeView />
      <HolographicObject shape="icosahedron" color="#4df3ff" height={400} />
    </>
  );
}