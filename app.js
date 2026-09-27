let currentUser = null;
let currentProfile = null;

let peerConnection = null;
let localStream = null;

let currentCall = null;
let pendingOffer = null;

let isMuted = false;
let cameraEnabled = true;


/* ================= AUTH UI ================= */

function showRegister() {

    document.getElementById("loginBox")
        .classList.add("hidden");

    document.getElementById("registerBox")
        .classList.remove("hidden");
}


function showLogin() {

    document.getElementById("registerBox")
        .classList.add("hidden");

    document.getElementById("loginBox")
        .classList.remove("hidden");
}


/* ================= REGISTER ================= */

async function register() {

    const name =
        document.getElementById("registerName").value.trim();

    const email =
        document.getElementById("registerEmail").value.trim();

    const password =
        document.getElementById("registerPassword").value;


    if (!name || !email || !password) {

        showMessage("Please fill all fields.");

        return;
    }


    const {
        data,
        error
    } = await supabaseClient.auth.signUp({

        email,
        password,

        options: {
            data: {
                full_name: name
            }
        }

    });


    if (error) {

        showMessage(error.message);

        return;
    }


    showMessage(
        "Account created. Check your email if confirmation is enabled."
    );
}


/* ================= LOGIN ================= */

async function login() {

    const email =
        document.getElementById("loginEmail").value.trim();

    const password =
        document.getElementById("loginPassword").value;


    const {
        data,
        error
    } = await supabaseClient.auth.signInWithPassword({

        email,
        password

    });


    if (error) {

        showMessage(error.message);

        return;
    }


    await startApp();
}


/* ================= LOGOUT ================= */

async function logout() {

    await supabaseClient.auth.signOut();

    location.reload();
}


/* ================= MESSAGE ================= */

function showMessage(message) {

    document.getElementById("authMessage")
        .textContent = message;
}


/* ================= START ================= */

async function startApp() {

    const {
        data
    } = await supabaseClient.auth.getUser();


    if (!data.user) return;


    currentUser = data.user;


    document.getElementById("authScreen")
        .classList.add("hidden");

    document.getElementById("appScreen")
        .classList.remove("hidden");


    document.getElementById("myEmail")
        .textContent = currentUser.email;


    const name =
        currentUser.user_metadata?.full_name ||
        currentUser.email.split("@")[0];


    document.getElementById("myName")
        .textContent = name;

    document.getElementById("myAvatar")
        .textContent =
        name.charAt(0).toUpperCase();


    await loadUsers();

    subscribeToCalls();
}


/* ================= CHECK SESSION ================= */

async function checkSession() {

    const {
        data
    } = await supabaseClient.auth.getSession();


    if (data.session) {

        await startApp();

    }

}


checkSession();


/* ================= USERS ================= */

async function loadUsers() {

    const {
        data,
        error
    } = await supabaseClient
        .from("profiles")
        .select("*")
        .neq("id", currentUser.id)
        .order("full_name");


    const container =
        document.getElementById("usersList");


    if (error) {

        container.innerHTML =
            `<p style="color:red">
                ${error.message}
            </p>`;

        return;
    }


    if (!data || data.length === 0) {

        container.innerHTML =
            `<p style="color:#777">
                No other users yet.
            </p>`;

        return;
    }


    container.innerHTML = "";


    data.forEach(user => {

        const name =
            user.full_name ||
            user.email ||
            "User";


        const div =
            document.createElement("div");


        div.className = "user-card";


        div.innerHTML = `

            <div class="user-left">

                <div class="user-avatar">
                    ${name.charAt(0).toUpperCase()}
                </div>

                <div>

                    <strong>
                        ${escapeHtml(name)}
                    </strong>

                    <br>

                    <small style="color:#777">
                        ${user.online ? "● Online" : "○ Offline"}
                    </small>

                </div>

            </div>


            <div class="call-buttons">

                <button
                    class="voice"
                    onclick="startCall(
                        '${user.id}',
                        '${escapeAttribute(name)}',
                        false
                    )">
                    📞
                </button>

                <button
                    class="video"
                    onclick="startCall(
                        '${user.id}',
                        '${escapeAttribute(name)}',
                        true
                    )">
                    🎥
                </button>

            </div>
        `;


        container.appendChild(div);

    });

}


/* ================= WEBRTC ================= */

const rtcConfig = {

    iceServers: [

        {
            urls:
                "stun:stun.l.google.com:19302"
        },

        {
            urls:
                "stun:stun1.l.google.com:19302"
        }

    ]

};


/* ================= START CALL ================= */

async function startCall(
    targetUserId,
    targetName,
    videoCall
) {

    try {

        currentCall = {

            targetUserId,
            targetName,
            videoCall

        };


        localStream =
            await navigator.mediaDevices.getUserMedia({

                audio: true,

                video: videoCall

            });


        showCallScreen(
            targetName,
            videoCall
        );


        document.getElementById("localVideo")
            .srcObject = localStream;


        peerConnection =
            createPeerConnection();


        localStream.getTracks()
            .forEach(track => {

                peerConnection.addTrack(
                    track,
                    localStream
                );

            });


        const offer =
            await peerConnection.createOffer();


        await peerConnection.setLocalDescription(
            offer
        );


        await sendSignal({

            type: "offer",

            to: targetUserId,

            from: currentUser.id,

            offer: offer,

            video: videoCall

        });


        updateCallStatus(
            "Calling..."
        );

    }

    catch (error) {

        console.error(error);

        alert(
            "Camera/Microphone permission required."
        );

        cleanupCall();

    }

}


/* ================= PEER ================= */

function createPeerConnection() {

    const pc =
        new RTCPeerConnection(
            rtcConfig
        );


    pc.onicecandidate = async event => {

        if (
            event.candidate &&
            currentCall
        ) {

            await sendSignal({

                type: "candidate",

                to: currentCall.targetUserId,

                from: currentUser.id,

                candidate:
                    event.candidate

            });

        }

    };


    pc.ontrack = event => {

        const remoteVideo =
            document.getElementById(
                "remoteVideo"
            );


        if (
            remoteVideo.srcObject !==
            event.streams[0]
        ) {

            remoteVideo.srcObject =
                event.streams[0];

        }

    };


    pc.onconnectionstatechange = () => {

        if (
            pc.connectionState ===
            "connected"
        ) {

            updateCallStatus(
                "Connected"
            );

        }


        if (
            pc.connectionState ===
            "disconnected" ||
            pc.connectionState ===
            "failed" ||
            pc.connectionState ===
            "closed"
        ) {

            cleanupCall();

        }

    };


    return pc;
}


/* ================= SIGNAL ================= */

async function sendSignal(payload) {

    const {
        error
    } = await supabaseClient
        .from("call_signals")
        .insert({

            sender_id:
                payload.from,

            receiver_id:
                payload.to,

            signal:
                payload

        });


    if (error) {

        console.error(
            "Signal error:",
            error
        );

    }

}


/* ================= RECEIVE SIGNAL ================= */

function subscribeToCalls() {

    supabaseClient

        .channel(
            "incoming-calls-" +
            currentUser.id
        )

        .on(

            "postgres_changes",

            {
                event: "INSERT",

                schema: "public",

                table: "call_signals",

                filter:
                    `receiver_id=eq.${currentUser.id}`

            },

            async payload => {

                await handleSignal(
                    payload.new
                );

            }

        )

        .subscribe();

}


/* ================= HANDLE SIGNAL ================= */

async function handleSignal(row) {

    const signal = row.signal;


    if (
        signal.type === "offer"
    ) {

        pendingOffer = {

            row,
            signal

        };


        await getCallerName(
            signal.from
        );

        return;
    }


    if (
        signal.type === "answer"
    ) {

        if (!peerConnection)
            return;


        await peerConnection
            .setRemoteDescription(

                new RTCSessionDescription(
                    signal.answer
                )

            );


        updateCallStatus(
            "Connected"
        );

        return;
    }


    if (
        signal.type === "candidate"
    ) {

        if (
            peerConnection &&
            signal.candidate
        ) {

            try {

                await peerConnection
                    .addIceCandidate(

                        new RTCIceCandidate(
                            signal.candidate
                        )

                    );

            }
            catch (error) {

                console.error(error);

            }

        }

    }


    if (
        signal.type === "hangup"
    ) {

        cleanupCall();

    }

}


/* ================= CALLER NAME ================= */

async function getCallerName(
    callerId
) {

    const {
        data
    } = await supabaseClient

        .from("profiles")

        .select("full_name")

        .eq("id", callerId)

        .single();


    const name =
        data?.full_name ||
        "Unknown";


    document.getElementById(
        "incomingName"
    ).textContent = name;


    document.getElementById(
        "incomingCall"
    ).classList.remove(
        "hidden"
    );

}


/* ================= ACCEPT ================= */

async function acceptCall() {

    if (!pendingOffer)
        return;


    document.getElementById(
        "incomingCall"
    ).classList.add(
        "hidden"
    );


    const signal =
        pendingOffer.signal;


    currentCall = {

        targetUserId:
            signal.from,

        targetName:
            document.getElementById(
                "incomingName"
            ).textContent,

        videoCall:
            signal.video

    };


    try {

        localStream =
            await navigator.mediaDevices
                .getUserMedia({

                    audio: true,

                    video:
                        signal.video

                });


        showCallScreen(

            currentCall.targetName,

            currentCall.videoCall

        );


        document.getElementById(
            "localVideo"
        ).srcObject =
            localStream;


        peerConnection =
            createPeerConnection();


        localStream.getTracks()
            .forEach(track => {

                peerConnection.addTrack(
                    track,
                    localStream
                );

            });


        await peerConnection
            .setRemoteDescription(

                new RTCSessionDescription(
                    signal.offer
                )

            );


        const answer =
            await peerConnection
                .createAnswer();


        await peerConnection
            .setLocalDescription(
                answer
            );


        await sendSignal({

            type: "answer",

            to: signal.from,

            from: currentUser.id,

            answer: answer

        });


        updateCallStatus(
            "Connecting..."
        );


        pendingOffer = null;

    }

    catch (error) {

        console.error(error);

        cleanupCall();

    }

}


/* ================= DECLINE ================= */

async function declineCall() {

    if (pendingOffer) {

        await sendSignal({

            type: "hangup",

            to:
                pendingOffer.signal.from,

            from:
                currentUser.id

        });

    }


    pendingOffer = null;


    document.getElementById(
        "incomingCall"
    ).classList.add(
        "hidden"
    );

}


/* ================= CALL SCREEN ================= */

function showCallScreen(
    name,
    video
) {

    document.getElementById(
        "callScreen"
    ).classList.remove(
        "hidden"
    );


    document.getElementById(
        "callUser"
    ).textContent = name;


    document.getElementById(
        "remoteVideo"
    ).style.display =
        video ? "block" : "none";


    document.getElementById(
        "localVideo"
    ).style.display =
        video ? "block" : "none";


    document.getElementById(
        "callAvatar"
    ).textContent =
        name.charAt(0).toUpperCase();

}


function updateCallStatus(
    status
) {

    document.getElementById(
        "callStatus"
    ).textContent = status;

}


/* ================= MUTE ================= */

function toggleMute() {

    if (!localStream)
        return;


    const audioTracks =
        localStream.getAudioTracks();


    audioTracks.forEach(track => {

        track.enabled =
            !track.enabled;

        isMuted =
            !track.enabled;

    });


    document.getElementById(
        "muteBtn"
    ).textContent =
        isMuted ? "🔇" : "🎤";

}


/* ================= CAMERA ================= */

function toggleCamera() {

    if (!localStream)
        return;


    const tracks =
        localStream.getVideoTracks();


    tracks.forEach(track => {

        track.enabled =
            !track.enabled;

        cameraEnabled =
            track.enabled;

    });


    document.getElementById(
        "cameraBtn"
    ).textContent =
        cameraEnabled ? "📷" : "🚫";

}


/* ================= END CALL ================= */

async function endCall() {

    if (currentCall) {

        await sendSignal({

            type: "hangup",

            to:
                currentCall.targetUserId,

            from:
                currentUser.id

        });

    }


    cleanupCall();

}


/* ================= CLEANUP ================= */

function cleanupCall() {

    if (localStream) {

        localStream
            .getTracks()
            .forEach(track =>
                track.stop()
            );

        localStream = null;

    }


    if (peerConnection) {

        peerConnection.close();

        peerConnection = null;

    }


    document.getElementById(
        "localVideo"
    ).srcObject = null;


    document.getElementById(
        "remoteVideo"
    ).srcObject = null;


    document.getElementById(
        "callScreen"
    ).classList.add(
        "hidden"
    );


    currentCall = null;

    pendingOffer = null;

}


/* ================= SECURITY ================= */

function escapeHtml(text) {

    return String(text)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

}


function escapeAttribute(text) {

    return String(text)
        .replaceAll("\\", "\\\\")
        .replaceAll("'", "\\'")
        .replaceAll('"', '\\"');

}
