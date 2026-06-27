import { Center } from "@/components/ui/center";
import { Spinner } from "@/components/ui/spinner";

type PendingProps = {
  message?: string;
};

function Pending(props: PendingProps) {
  return (
    <Center>
      <div className="flex max-w-80 items-center gap-x-2">
        <Spinner />
        <p className="shimmer">{props.message ?? "Loading..."}</p>
      </div>
    </Center>
  );
}

export { Pending };
