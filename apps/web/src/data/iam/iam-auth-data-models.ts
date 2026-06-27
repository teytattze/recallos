type IamAuthActionDataModel = {
  readonly succeeded: boolean;
};

type IamAuthSessionDataModel = {
  readonly user: IamAuthUserDataModel | null;
};

type IamAuthUserDataModel = {
  readonly email: string;
  readonly id: string;
};

export type {
  IamAuthActionDataModel,
  IamAuthSessionDataModel,
  IamAuthUserDataModel,
};
