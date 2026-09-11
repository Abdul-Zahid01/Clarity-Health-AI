"use client";

import dynamic from "next/dynamic";

const NearbyCareMap = dynamic(() => import("@/components/nearby-care-map").then((module) => module.NearbyCareMap), { ssr: false });

export default function NearbyCarePage() {
  return <NearbyCareMap />;
}