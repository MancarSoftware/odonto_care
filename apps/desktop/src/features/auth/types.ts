export type AuthenticatedUser = {
  id: string;
  email: string;
  fullName: string;
  role: "ADMIN" | "DENTIST" | "RECEPTION";
};

export type LoginResponse = {
  accessToken: string;
  user: AuthenticatedUser;
};
