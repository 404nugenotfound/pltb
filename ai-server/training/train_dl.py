import os
import joblib
import traceback
import numpy as np
from sklearn.preprocessing import MinMaxScaler
from config import MODEL_FOLDER, TARGET, STEP, TRAIN_VARS, USER_FOLDER


def train_dl_models(df, target_var: str = None, cancel_check=None, username=""):
    if target_var is None:
        target_var = TARGET

    try:
        import tensorflow as tf
        from tensorflow.keras.models import Sequential
        from tensorflow.keras.layers import LSTM as KerasLSTM, Bidirectional, Dense, Dropout
        from tensorflow.keras.callbacks import EarlyStopping, Callback

        # =========================
        # PATH SETUP
        # =========================
        user_model_dir = os.path.join(USER_FOLDER, username)
        os.makedirs(user_model_dir, exist_ok=True)

        def save_path(filename):
            return os.path.join(user_model_dir, filename)

        # ✅ Paksa CPU saja — hindari GPU memory conflict antar thread
        tf.config.set_visible_devices([], 'GPU')

        class CancelCallback(Callback):
            def __init__(self, check_fn):
                super().__init__()
                self.check_fn = check_fn

            def on_epoch_end(self, epoch, logs=None):
                if self.check_fn():
                    print("🛑 Training DL dihentikan via cancel")
                    self.model.stop_training = True

        if target_var not in df.columns:
            print(f"⚠️ Kolom {target_var} tidak ada, skip DL")
            return False

        exclude = set(TRAIN_VARS)
        dl_cols = [c for c in df.columns if c not in exclude]
        n_rows       = len(df)
        split_scaler = int(n_rows * 0.8)

        X_all = df[dl_cols].values
        if target_var == "WD10M":
            y_sin = np.sin(np.deg2rad(df[target_var].values))
            y_cos = np.cos(np.deg2rad(df[target_var].values))
            y_all = np.stack([y_sin, y_cos], axis=1)
        else:
            y_all = df[target_var].values.reshape(-1, 1)

        scaler_X = MinMaxScaler()
        scaler_X.fit(X_all[:split_scaler])
        X_scaled = scaler_X.transform(X_all).astype(np.float32)

        if target_var == "WD10M":
            scaler_y = None
            y_scaled = y_all.astype(np.float32)
        else:
            scaler_y = MinMaxScaler()
            scaler_y.fit(y_all[:split_scaler])
            y_scaled = scaler_y.transform(y_all).astype(np.float32)

        n        = len(X_scaled)
        indices  = np.arange(STEP, n)
        seqs     = np.array([X_scaled[i - STEP:i] for i in indices], dtype=np.float32)
        targets  = y_scaled[STEP:]

        n_feat = seqs.shape[2]
        n_out  = 2 if target_var == "WD10M" else 1
        suffix = f"_{target_var}"

        split_train = int(len(seqs) * 0.8)
        split_val   = int(len(seqs) * 0.9)

        X_train, X_val = seqs[:split_train],   seqs[split_train:split_val]
        y_train, y_val = targets[:split_train], targets[split_train:split_val]

        es = EarlyStopping(
            monitor="val_loss",
            patience=3,
            restore_best_weights=True,
            min_delta=0.0001
        )

        callbacks = [es]
        if cancel_check:
            callbacks.append(CancelCallback(cancel_check))

        # =========================
        # LSTM
        # =========================
        def build_and_train(model, name):
            model.compile(optimizer="adam", loss="mse")
            model.fit(
                X_train, y_train,
                validation_data=(X_val, y_val),
                epochs=15,
                batch_size=512,
                callbacks=callbacks,
                verbose=1
            )
            model.save(save_path(f"{name}{suffix}.h5"))  # ✅ per-user
            print(f"✅ {name}{suffix} disimpan")

        lstm = Sequential([
            KerasLSTM(86, return_sequences=True, input_shape=(STEP, n_feat)),
            Dropout(0.2),
            KerasLSTM(64),
            Dropout(0.2),
            Dense(16, activation="relu"),
            Dense(n_out)
        ])
        build_and_train(lstm, "lstm")

        tf.keras.backend.clear_session()

        # =========================
        # BiLSTM
        # =========================
        bilstm = Sequential([
            Bidirectional(KerasLSTM(32, input_shape=(STEP, n_feat))),
            Dropout(0.3),
            Dense(8, activation="relu"),
            Dense(n_out)
        ])

        callbacks = [
            EarlyStopping(
                monitor="val_loss",
                patience=3,
                restore_best_weights=True,
                min_delta=0.0001
            )
        ]
        if cancel_check:
            callbacks.append(CancelCallback(cancel_check))

        bilstm.compile(optimizer="adam", loss="mse")
        bilstm.fit(
            X_train, y_train,
            validation_data=(X_val, y_val),
            epochs=15,
            batch_size=512,
            callbacks=callbacks,
            verbose=1
        )
        bilstm.save(save_path(f"bilstm{suffix}.h5"))  # ✅ per-user
        print(f"✅ bilstm{suffix} disimpan")

        # =========================
        # SIMPAN SCALER & METADATA
        # =========================
        joblib.dump(scaler_X, save_path(f"scaler_X{suffix}.pkl"))  # ✅ per-user
        if scaler_y is not None:
            joblib.dump(scaler_y, save_path(f"scaler_y{suffix}.pkl"))
        joblib.dump(target_var == "WD10M", save_path(f"is_circular{suffix}.pkl"))
        joblib.dump(dl_cols,               save_path(f"dl_cols{suffix}.pkl"))

        print(f"✅ DL training selesai untuk {target_var}")
        return True

    except Exception as e:
        print(f"⚠️ DL training gagal untuk {target_var}: {e}")
        traceback.print_exc()
        return False