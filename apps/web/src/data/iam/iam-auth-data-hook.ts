import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";

import type {
  IamAuthSendEmailOtpInput,
  IamAuthVerifyEmailOtpInput,
} from "@/data/iam/iam-auth-data-schemas";

import type { IamAuthDataSourceError } from "./iam-auth-data-errors";

import {
  type IamAuthActionDataModel,
  type IamAuthSessionDataModel,
} from "./iam-auth-data-models";
import { iamAuthDataSource } from "./iam-auth-data-source";

type IamAuthActionMutationResult<TInput> = UseMutationResult<
  IamAuthActionDataModel,
  IamAuthDataSourceError,
  TInput
>;

const iamAuthDataQueryKeys = {
  activeSession: () => ["iam", "auth", "active-session"] as const,
};

const useGetActiveSession = (): UseQueryResult<
  IamAuthSessionDataModel | null,
  IamAuthDataSourceError
> => {
  return useQuery<IamAuthSessionDataModel | null, IamAuthDataSourceError>({
    queryFn: iamAuthDataSource.getActiveSession,
    queryKey: iamAuthDataQueryKeys.activeSession(),
  });
};

const useSendEmailOtp =
  (): IamAuthActionMutationResult<IamAuthSendEmailOtpInput> => {
    return useMutation<
      IamAuthActionDataModel,
      IamAuthDataSourceError,
      IamAuthSendEmailOtpInput
    >({
      mutationFn: iamAuthDataSource.sendEmailOtp,
    });
  };

const useSignOut = (): IamAuthActionMutationResult<void> => {
  const queryClient = useQueryClient();

  return useMutation<IamAuthActionDataModel, IamAuthDataSourceError, void>({
    mutationFn: iamAuthDataSource.signOut,
    onSuccess: async () => {
      queryClient.setQueryData(iamAuthDataQueryKeys.activeSession(), {
        user: null,
      } satisfies IamAuthSessionDataModel);
      await queryClient.invalidateQueries({
        queryKey: iamAuthDataQueryKeys.activeSession(),
      });
    },
  });
};

const useVerifyEmailOtp =
  (): IamAuthActionMutationResult<IamAuthVerifyEmailOtpInput> => {
    const queryClient = useQueryClient();

    return useMutation<
      IamAuthActionDataModel,
      IamAuthDataSourceError,
      IamAuthVerifyEmailOtpInput
    >({
      mutationFn: iamAuthDataSource.verifyEmailOtp,
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: iamAuthDataQueryKeys.activeSession(),
        });
      },
    });
  };

const iamAuthDataHook = {
  useGetActiveSession,
  useSendEmailOtp,
  useSignOut,
  useVerifyEmailOtp,
};
export { iamAuthDataQueryKeys, iamAuthDataHook };
