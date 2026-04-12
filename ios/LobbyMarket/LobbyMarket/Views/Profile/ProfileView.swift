//
//  ProfileView.swift
//  LobbyMarket
//

import SwiftUI

struct ProfileView: View {
    @EnvironmentObject var auth: AuthService
    @State private var profile: Profile?

    var body: some View {
        NavigationStack {
            ZStack {
                Color.surface0.ignoresSafeArea()

                if !auth.isAuthenticated {
                    LoginView()
                } else {
                    ScrollView {
                        VStack(spacing: Spacing.md) {
                            avatar
                            identity
                            statsGrid
                            actionsBlock
                            Spacer(minLength: 40)
                        }
                        .padding(Spacing.md)
                    }
                }
            }
            .navigationTitle("Profile")
            .navigationBarTitleDisplayMode(.large)
            .task {
                if let uid = auth.currentUserId {
                    profile = try? await SupabaseClient.shared.fetchProfile(id: uid)
                }
            }
        }
    }

    private var avatar: some View {
        Circle()
            .fill(LinearGradient.forGradient)
            .frame(width: 96, height: 96)
            .overlay(
                Text(initial)
                    .font(.system(size: 40, weight: .heavy, design: .rounded))
                    .foregroundStyle(.white)
            )
            .shadow(color: .forBlue.opacity(0.4), radius: 20, x: 0, y: 8)
    }

    private var initial: String {
        let name = profile?.displayName ?? profile?.username ?? auth.currentUsername ?? "?"
        return String(name.first ?? "?").uppercased()
    }

    private var identity: some View {
        VStack(spacing: 4) {
            Text(profile?.displayName ?? profile?.username ?? auth.currentUsername ?? "Citizen")
                .font(.lmTitle)
                .foregroundStyle(.white)
            if let bio = profile?.bio {
                Text(bio)
                    .font(.lmBody)
                    .foregroundStyle(.textSecondary)
                    .multilineTextAlignment(.center)
            }
        }
    }

    private var statsGrid: some View {
        HStack(spacing: Spacing.sm) {
            statCard("TOPICS", value: "\(profile?.topicsCreated ?? 0)", color: .gold)
            statCard("VOTES", value: "\(profile?.votesCast ?? 0)", color: .forBlue)
            statCard("REPUTATION", value: "\(profile?.reputation ?? 0)", color: .emerald)
        }
    }

    private func statCard(_ title: String, value: String, color: Color) -> some View {
        VStack(spacing: 4) {
            Text(value)
                .font(.system(size: 24, weight: .heavy, design: .rounded))
                .foregroundStyle(.white)
            Text(title)
                .font(.system(size: 10, weight: .heavy))
                .kerning(1.0)
                .foregroundStyle(color)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, Spacing.sm)
        .background(
            RoundedRectangle(cornerRadius: Radii.md)
                .fill(Color.surface200)
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.md)
                        .stroke(color.opacity(0.3), lineWidth: 1)
                )
        )
    }

    private var actionsBlock: some View {
        VStack(spacing: Spacing.xs) {
            Button(role: .destructive) {
                auth.signOut()
            } label: {
                HStack {
                    Image(systemName: "rectangle.portrait.and.arrow.right")
                    Text("Sign Out")
                        .font(.lmBodyBold)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .background(
                    RoundedRectangle(cornerRadius: Radii.md)
                        .fill(Color.surface200)
                        .overlay(
                            RoundedRectangle(cornerRadius: Radii.md)
                                .stroke(Color.againstRed.opacity(0.4), lineWidth: 1)
                        )
                )
                .foregroundStyle(.againstRed)
            }
        }
    }
}

#Preview {
    ProfileView()
        .environmentObject(AuthService())
}
