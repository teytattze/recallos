import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import type { FileRoutesByFullPath } from "@/routeTree.gen";

import { Center } from "@/components/extended-ui/center";
import { Pending } from "@/components/extended-ui/pending";

type SignUpEmailOtpVerifiedStepProps = {
  redirectTo: keyof FileRoutesByFullPath;
};

function SignUpEmailOtpVerifiedStep(props: SignUpEmailOtpVerifiedStepProps) {
  const { redirectTo } = props;

  const navigate = useNavigate({ from: "/sign-up" });

  useEffect(() => {
    void navigate({ to: redirectTo });
  }, [navigate]);

  return (
    <Center>
      <Pending />
    </Center>
  );
}

export { SignUpEmailOtpVerifiedStep };
