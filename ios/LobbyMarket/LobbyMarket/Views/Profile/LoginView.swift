//
//  LoginView.swift
//  LobbyMarket
//

import SwiftUI

struct LoginView: View {
    @EnvironmentObject var auth: AuthService

    enum Mode { case signIn, signUp }
    @State private var mode: Mode = .signIn
    @State private var email: String = ""
    @State private var password: String = ""
    @State private var username: String = ""
    @State private var isWorking: Bool = false

    var body: some View {
        ZStack {
            Color.surface0.ignoresSafeArea()

            VStack(spacing: Spacing.lg) {
                VStack(spacing: Spacing.xs) {
                    Image(systemName: "building.columns.fill")
                        .font(.system(size: 48))
                        .foregroundStyle(.gold)
                    Text("LOBBY MARKET")
                        .font(.system(size: 20, weight: .heavy, design: .rounded))
                        .kerning(2.0)
                        .foregroundStyle(.white)
                    Text("Debate. Vote. Decide.")
                        .font(.lmCaption)
                        .foregroundStyle(.textSecondary)
                }
                .padding(.top, 40)

                Picker("", selection: $mode) {
                    Text("Sign In").tag(Mode.signIn)
                    Text("Sign Up").tag(Mode.signUp)
                }
                .pickerStyle(.segmented)

                VStack(spacing: Spacing.sm) {
                    if mode == .signUp {
                        inputField(placeholder: "Username", text: $username, icon: "person")
                    }
                    inputField(placeholder: "Email", text: $email, icon: "envelope", keyboard: .emailAddress)
                    inputField(placeholder: "Password", text: $password, icon: "lock", isSecure: true)
                }

                Button {
                    Task { await submit() }
                } label: {
                    HStack {
                        if isWorking {
                            ProgressView().tint(.white)
                        }
                        Text(mode == .signIn ? "Sign In" : "Create Account")
                            .font(.lmBodyBold)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(RoundedRectangle(cornerRadius: Radii.md).fill(LinearGradient.forGradient))
                    .foregroundStyle(.white)
                }
                .buttonStyle(PressableButtonStyle())

                if let err = auth.lastError {
                    Text(err)
                        .font(.lmCaption)
                        .foregroundStyle(.againstRed)
                        .multilineTextAlignment(.center)
                }

                Spacer()
            }
            .padding(Spacing.lg)
        }
    }

    private func inputField(
        placeholder: String,
        text: Binding<String>,
        icon: String,
        isSecure: Bool = false,
        keyboard: UIKeyboardType = .default
    ) -> some View {
        HStack {
            Image(systemName: icon)
                .foregroundStyle(.textSecondary)
            Group {
                if isSecure {
                    SecureField(placeholder, text: text)
                } else {
                    TextField(placeholder, text: text)
                        .keyboardType(keyboard)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                }
            }
            .foregroundStyle(.white)
            .tint(.forBlue)
        }
        .padding(Spacing.sm)
        .background(RoundedRectangle(cornerRadius: Radii.md).fill(Color.surface200))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.md)
                .stroke(Color.white.opacity(0.08), lineWidth: 1)
        )
    }

    private func submit() async {
        isWorking = true
        switch mode {
        case .signIn:
            await auth.signIn(email: email, password: password)
        case .signUp:
            await auth.signUp(email: email, password: password, username: username)
        }
        isWorking = false
    }
}

#Preview {
    LoginView()
        .environmentObject(AuthService())
}
